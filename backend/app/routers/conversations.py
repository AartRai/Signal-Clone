from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import crud, schemas, models
from .auth import get_current_user
from ..websocket_manager import manager

# Conversations Router: Handles creating, listing, and managing group and direct chats
router = APIRouter(prefix="/conversations", tags=["conversations"])

@router.get("/", response_model=List[schemas.ConversationResponse])
def get_user_conversations_list(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_convs = crud.get_user_conversations(db, user_id=current_user.id)
    
    response = []
    for conv in db_convs:
        # Get last message
        last_msg = crud.get_last_message_for_conversation(db, conv.id)
        # Get unread count
        unread = crud.get_unread_count_for_conversation(db, conv.id, current_user.id)
        
        # Build schema response
        conv_res = schemas.ConversationResponse.model_validate(conv)
        conv_res.last_message = schemas.MessageResponse.model_validate(last_msg) if last_msg else None
        conv_res.unread_count = unread
        response.append(conv_res)
        
    return response

@router.get("/{conversation_id}", response_model=schemas.ConversationResponse)
def get_conversation_details(
    conversation_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = crud.get_conversation(db, conversation_id=conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    # Check membership
    is_member = any(m.user_id == current_user.id for m in conv.members)
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")
        
    last_msg = crud.get_last_message_for_conversation(db, conv.id)
    unread = crud.get_unread_count_for_conversation(db, conv.id, current_user.id)
    
    conv_res = schemas.ConversationResponse.model_validate(conv)
    conv_res.last_message = schemas.MessageResponse.model_validate(last_msg) if last_msg else None
    conv_res.unread_count = unread
    return conv_res

@router.post("/", response_model=schemas.ConversationResponse)
def create_new_conversation(
    request: schemas.ConversationCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Ensure current user is in members list
    if current_user.id not in request.member_ids:
        request.member_ids.append(current_user.id)
        
    if not request.is_group:
        # For 1-on-1 direct chats, ensure we only have 2 members
        if len(request.member_ids) != 2:
            raise HTTPException(status_code=400, detail="Direct conversation must have exactly 2 members")
            
        other_user_id = [uid for uid in request.member_ids if uid != current_user.id][0]
        # Check if conversation already exists
        existing_conv = crud.get_direct_conversation(db, current_user.id, other_user_id)
        if existing_conv:
            last_msg = crud.get_last_message_for_conversation(db, existing_conv.id)
            unread = crud.get_unread_count_for_conversation(db, existing_conv.id, current_user.id)
            
            conv_res = schemas.ConversationResponse.model_validate(existing_conv)
            conv_res.last_message = schemas.MessageResponse.model_validate(last_msg) if last_msg else None
            conv_res.unread_count = unread
            return conv_res
            
    # Create the conversation
    new_conv = crud.create_conversation(db, request)
    
    # Broadcast "new_conversation" event to all members
    member_ids = [m.user_id for m in new_conv.members]
    
    # Prepare details response for broadcast
    conv_res = schemas.ConversationResponse.model_validate(new_conv)
    conv_res.last_message = None
    conv_res.unread_count = 0
    
    # We will trigger the broadcast
    import asyncio
    asyncio.create_task(
        manager.broadcast_to_users(
            {"event": "new_conversation", "data": conv_res.model_dump(mode='json')},
            member_ids
        )
    )
    
    return conv_res

@router.post("/{conversation_id}/members", response_model=schemas.ConversationMemberResponse)
def add_member(
    conversation_id: int,
    request: schemas.AddMemberRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = crud.get_conversation(db, conversation_id=conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    if not conv.is_group:
        raise HTTPException(status_code=400, detail="Cannot add members to direct chats")
        
    # Check if current user is admin of group
    admin_member = next((m for m in conv.members if m.user_id == current_user.id), None)
    if not admin_member or admin_member.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can add members")
        
    member = crud.add_conversation_member(db, conversation_id, request.user_id, request.role)
    
    # Broadcast updated member list event to all members
    member_ids = [m.user_id for m in conv.members]
    conv_res = schemas.ConversationResponse.model_validate(conv)
    
    import asyncio
    asyncio.create_task(
        manager.broadcast_to_users(
            {"event": "group_update", "data": conv_res.model_dump(mode='json')},
            member_ids
        )
    )
    
    return member

@router.delete("/{conversation_id}/members/{user_id}")
def remove_member(
    conversation_id: int,
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = crud.get_conversation(db, conversation_id=conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    if not conv.is_group:
        raise HTTPException(status_code=400, detail="Cannot remove members from direct chats")
        
    # Check if current user is admin of group or removing themselves
    is_self = current_user.id == user_id
    admin_member = next((m for m in conv.members if m.user_id == current_user.id), None)
    
    if not is_self and (not admin_member or admin_member.role != "admin"):
        raise HTTPException(status_code=403, detail="Only admins can remove other members")
        
    success = crud.remove_conversation_member(db, conversation_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Member not found in group")
        
    # Broadcast group update to all remaining members AND notify the removed member
    remaining_member_ids = [m.user_id for m in conv.members]
    conv_res = schemas.ConversationResponse.model_validate(conv)
    
    import asyncio
    asyncio.create_task(
        manager.broadcast_to_users(
            {"event": "group_update", "data": conv_res.model_dump(mode='json')},
            remaining_member_ids + [user_id]
        )
    )
    
    return {"message": "Member removed successfully"}

@router.post("/{conversation_id}/read")
def read_conversation(
    conversation_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = crud.get_conversation(db, conversation_id=conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    marked_count = crud.mark_conversation_as_read(db, conversation_id, current_user.id)
    
    # Broadcast read status update to other conversation members
    if marked_count > 0:
        member_ids = [m.user_id for m in conv.members if m.user_id != current_user.id]
        import asyncio
        asyncio.create_task(
            manager.broadcast_to_users(
                {
                    "event": "read_receipt", 
                    "data": {
                        "conversation_id": conversation_id,
                        "user_id": current_user.id,
                        "status": "read"
                    }
                },
                member_ids
            )
        )
        
    return {"marked_as_read": marked_count}
