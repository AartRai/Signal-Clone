from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func
import datetime
from typing import List, Optional
from . import models, schemas

# --- USER CRUD ---
# Functions to retrieve, create, and search for users within the database

def get_user(db: Session, user_id: int) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.username == username).first()

def get_user_by_phone(db: Session, phone: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.phone == phone).first()

def get_user_by_phone_or_username(db: Session, key: str) -> Optional[models.User]:
    return db.query(models.User).filter(
        or_(models.User.phone == key, models.User.username == key)
    ).first()

def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    db_user = models.User(
        username=user.username,
        phone=user.phone,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        is_online=False,
        last_seen=datetime.datetime.utcnow()
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: int, updates: schemas.UserUpdate) -> Optional[models.User]:
    db_user = get_user(db, user_id)
    if not db_user:
        return None
    if updates.display_name is not None:
        db_user.display_name = updates.display_name
    if updates.avatar_url is not None:
        db_user.avatar_url = updates.avatar_url
    db.commit()
    db.refresh(db_user)
    return db_user

def set_user_presence(db: Session, user_id: int, is_online: bool) -> Optional[models.User]:
    db_user = get_user(db, user_id)
    if db_user:
        db_user.is_online = is_online
        db_user.last_seen = datetime.datetime.utcnow()
        db.commit()
        db.refresh(db_user)
    return db_user


# --- CONTACT CRUD ---
# Functions managing one-way address book links between users

def get_contacts(db: Session, user_id: int) -> List[models.Contact]:
    return db.query(models.Contact).filter(models.Contact.user_id == user_id).all()

def add_contact(db: Session, user_id: int, contact_id: int) -> Optional[models.Contact]:
    # Check if contact already exists
    exists = db.query(models.Contact).filter(
        and_(models.Contact.user_id == user_id, models.Contact.contact_id == contact_id)
    ).first()
    if exists:
        return exists
    
    db_contact = models.Contact(user_id=user_id, contact_id=contact_id)
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    return db_contact


# --- CONVERSATION CRUD ---
# Functions for creating and retrieving group or 1:1 chat metadata and memberships

def get_conversation(db: Session, conversation_id: int) -> Optional[models.Conversation]:
    return db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()

def get_direct_conversation(db: Session, user1_id: int, user2_id: int) -> Optional[models.Conversation]:
    # A direct conversation has is_group=False and exactly both users as members
    subquery1 = db.query(models.ConversationMember.conversation_id).filter(
        models.ConversationMember.user_id == user1_id
    )
    subquery2 = db.query(models.ConversationMember.conversation_id).filter(
        models.ConversationMember.user_id == user2_id
    )
    
    conv = db.query(models.Conversation).filter(
        and_(
            models.Conversation.is_group == False,
            models.Conversation.id.in_(subquery1),
            models.Conversation.id.in_(subquery2)
        )
    ).first()
    return conv

def create_conversation(db: Session, conv: schemas.ConversationCreate) -> models.Conversation:
    db_conv = models.Conversation(
        name=conv.name,
        is_group=conv.is_group,
        avatar_url=None
    )
    db.add(db_conv)
    db.commit()
    db.refresh(db_conv)
    
    # Add members
    for uid in conv.member_ids:
        # First member in a group is admin by default
        role = "admin" if (conv.is_group and uid == conv.member_ids[0]) else "member"
        member = models.ConversationMember(
            conversation_id=db_conv.id,
            user_id=uid,
            role=role
        )
        db.add(member)
    db.commit()
    db.refresh(db_conv)
    return db_conv

def add_conversation_member(db: Session, conversation_id: int, user_id: int, role: str = "member") -> Optional[models.ConversationMember]:
    # Check if already a member
    exists = db.query(models.ConversationMember).filter(
        and_(models.ConversationMember.conversation_id == conversation_id, models.ConversationMember.user_id == user_id)
    ).first()
    if exists:
        return exists
    
    db_member = models.ConversationMember(
        conversation_id=conversation_id,
        user_id=user_id,
        role=role
    )
    db.add(db_member)
    # Touch conversation updated_at
    conv = get_conversation(db, conversation_id)
    if conv:
        conv.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(db_member)
    return db_member

def remove_conversation_member(db: Session, conversation_id: int, user_id: int) -> bool:
    member = db.query(models.ConversationMember).filter(
        and_(models.ConversationMember.conversation_id == conversation_id, models.ConversationMember.user_id == user_id)
    ).first()
    if member:
        db.delete(member)
        # Touch conversation updated_at
        conv = get_conversation(db, conversation_id)
        if conv:
            conv.updated_at = datetime.datetime.utcnow()
        db.commit()
        return True
    return False

def get_user_conversations(db: Session, user_id: int) -> List[models.Conversation]:
    delete_expired_messages(db)
    # Get all conversation IDs user is member of
    member_convs = db.query(models.ConversationMember.conversation_id).filter(
        models.ConversationMember.user_id == user_id
    ).subquery()
    
    return db.query(models.Conversation).filter(
        models.Conversation.id.in_(member_convs)
    ).order_by(desc(models.Conversation.updated_at)).all()


# --- MESSAGE CRUD ---
# Functions for creating, retrieving, and paginating messages, including read receipts and disappearing timers

def get_message(db: Session, message_id: int) -> Optional[models.Message]:
    return db.query(models.Message).filter(models.Message.id == message_id).first()

def delete_expired_messages(db: Session):
    now = datetime.datetime.utcnow()
    candidates = db.query(models.Message).filter(models.Message.is_disappearing == True).all()
    expired_ids = []
    for msg in candidates:
        if msg.disappear_after:
            expiry = msg.created_at + datetime.timedelta(seconds=msg.disappear_after)
            if expiry < now:
                expired_ids.append(msg.id)
                
    if expired_ids:
        expired_msgs = db.query(models.Message).filter(models.Message.id.in_(expired_ids)).all()
        for msg in expired_msgs:
            db.delete(msg)
        db.commit()

def get_conversation_messages(db: Session, conversation_id: int, limit: int = 100) -> List[models.Message]:
    delete_expired_messages(db)
    return db.query(models.Message).filter(
        models.Message.conversation_id == conversation_id
    ).order_by(models.Message.created_at).limit(limit).all()

def create_message(db: Session, message: schemas.MessageCreate, sender_id: int) -> models.Message:
    db_msg = models.Message(
        conversation_id=message.conversation_id,
        sender_id=sender_id,
        content=message.content,
        message_type=message.message_type,
        attachment_url=message.attachment_url,
        attachment_type=message.attachment_type,
        reply_to_id=message.reply_to_id,
        is_disappearing=message.is_disappearing,
        disappear_after=message.disappear_after
    )
    db.add(db_msg)
    db.flush() # Populate db_msg.id
    
    # Touch conversation updated_at to bring it to top of list
    conv = get_conversation(db, message.conversation_id)
    if conv:
        conv.updated_at = datetime.datetime.utcnow()
        
        # Create message status indicators for all OTHER members in conversation
        for member in conv.members:
            if member.user_id != sender_id:
                # Add status: 'sent' (since websocket delivery is about to happen, initially marked as 'sent')
                status = models.MessageStatus(
                    message_id=db_msg.id,
                    user_id=member.user_id,
                    status="sent"
                )
                db.add(status)
                
    db.commit()
    db.refresh(db_msg)
    return db_msg

def delete_message(db: Session, message_id: int, user_id: int) -> bool:
    """Deletes a message if the user is the sender"""
    msg = db.query(models.Message).filter(
        and_(models.Message.id == message_id, models.Message.sender_id == user_id)
    ).first()
    if msg:
        db.delete(msg)
        db.commit()
        return True
    return False

def mark_conversation_as_read(db: Session, conversation_id: int, user_id: int):
    # Find all messages in conversation where this user has status != 'read' and update to 'read'
    subquery = db.query(models.Message.id).filter(models.Message.conversation_id == conversation_id).subquery()
    
    statuses = db.query(models.MessageStatus).filter(
        and_(
            models.MessageStatus.message_id.in_(subquery),
            models.MessageStatus.user_id == user_id,
            models.MessageStatus.status != "read"
        )
    ).all()
    
    for s in statuses:
        s.status = "read"
        s.updated_at = datetime.datetime.utcnow()
    
    if statuses:
        db.commit()
    return len(statuses)

def update_message_status(db: Session, message_id: int, user_id: int, status: str) -> Optional[models.MessageStatus]:
    db_status = db.query(models.MessageStatus).filter(
        and_(models.MessageStatus.message_id == message_id, models.MessageStatus.user_id == user_id)
    ).first()
    
    if db_status:
        # Don't downgrade status (e.g. read -> delivered)
        status_ranks = {"sending": 0, "sent": 1, "delivered": 2, "read": 3}
        if status_ranks.get(status, 0) > status_ranks.get(db_status.status, 0):
            db_status.status = status
            db_status.updated_at = datetime.datetime.utcnow()
            db.commit()
            db.refresh(db_status)
    return db_status

def add_message_reaction(db: Session, message_id: int, user_id: int, reaction: str) -> models.MessageReaction:
    # Check if already reacted with something
    db_reaction = db.query(models.MessageReaction).filter(
        and_(models.MessageReaction.message_id == message_id, models.MessageReaction.user_id == user_id)
    ).first()
    
    if db_reaction:
        db_reaction.reaction = reaction
        db_reaction.created_at = datetime.datetime.utcnow()
    else:
        db_reaction = models.MessageReaction(
            message_id=message_id,
            user_id=user_id,
            reaction=reaction
        )
        db.add(db_reaction)
    db.commit()
    db.refresh(db_reaction)
    return db_reaction

def remove_message_reaction(db: Session, message_id: int, user_id: int) -> bool:
    db_reaction = db.query(models.MessageReaction).filter(
        and_(models.MessageReaction.message_id == message_id, models.MessageReaction.user_id == user_id)
    ).first()
    if db_reaction:
        db.delete(db_reaction)
        db.commit()
        return True
    return False

# --- UTILITY CONVERTERS FOR SERIALIZATION ---

def get_last_message_for_conversation(db: Session, conversation_id: int) -> Optional[models.Message]:
    delete_expired_messages(db)
    return db.query(models.Message).filter(
        models.Message.conversation_id == conversation_id
    ).order_by(desc(models.Message.created_at)).first()

def get_unread_count_for_conversation(db: Session, conversation_id: int, user_id: int) -> int:
    subquery = db.query(models.Message.id).filter(models.Message.conversation_id == conversation_id).subquery()
    return db.query(models.MessageStatus).filter(
        and_(
            models.MessageStatus.message_id.in_(subquery),
            models.MessageStatus.user_id == user_id,
            models.MessageStatus.status != "read"
        )
    ).count()
