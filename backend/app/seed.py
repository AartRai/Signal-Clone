from sqlalchemy.orm import Session
import datetime
from .database import SessionLocal, engine, Base
from . import models, schemas, crud

def seed_database(db: Session):
    # Check if database is already seeded
    if db.query(models.User).first() is not None:
        print("Database already seeded.")
        return

    print("Seeding database...")

    # 1. Create Users
    users_data = [
        {"username": "alice", "phone": "+1111111111", "display_name": "Alice Smith", "avatar_url": "https://api.dicebear.com/7.x/adventurer/svg?seed=alice"},
        {"username": "bob", "phone": "+2222222222", "display_name": "Bob Jones", "avatar_url": "https://api.dicebear.com/7.x/adventurer/svg?seed=bob"},
        {"username": "charlie", "phone": "+3333333333", "display_name": "Charlie Brown", "avatar_url": "https://api.dicebear.com/7.x/adventurer/svg?seed=charlie"},
        {"username": "dana", "phone": "+4444444444", "display_name": "Dana Scully", "avatar_url": "https://api.dicebear.com/7.x/adventurer/svg?seed=dana"},
        {"username": "evan", "phone": "+5555555555", "display_name": "Evan Wright", "avatar_url": "https://api.dicebear.com/7.x/adventurer/svg?seed=evan"},
    ]

    db_users = {}
    for u in users_data:
        db_user = models.User(
            username=u["username"],
            phone=u["phone"],
            display_name=u["display_name"],
            avatar_url=u["avatar_url"],
            is_online=False,
            last_seen=datetime.datetime.utcnow() - datetime.timedelta(minutes=30)
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        db_users[u["username"]] = db_user

    alice = db_users["alice"]
    bob = db_users["bob"]
    charlie = db_users["charlie"]
    dana = db_users["dana"]
    
    # 2. Add Contacts (Mutual)
    # Alice <-> Bob, Charlie, Dana
    # Bob <-> Charlie, Dana
    contacts_pairs = [
        (alice.id, bob.id),
        (alice.id, charlie.id),
        (alice.id, dana.id),
        (bob.id, charlie.id),
        (bob.id, dana.id),
        (charlie.id, dana.id)
    ]
    for uid, cid in contacts_pairs:
        crud.add_contact(db, uid, cid)
        crud.add_contact(db, cid, uid)

    # 3. Create Direct Conversations
    # Alice & Bob
    conv_alice_bob = crud.create_conversation(
        db, 
        schemas.ConversationCreate(
            is_group=False, 
            member_ids=[alice.id, bob.id]
        )
    )
    # Alice & Charlie
    crud.create_conversation(
        db, 
        schemas.ConversationCreate(
            is_group=False, 
            member_ids=[alice.id, charlie.id]
        )
    )

    # 4. Create Group Conversation
    # "The Fellowship" (Alice, Bob, Charlie, Dana)
    conv_fellowship = crud.create_conversation(
        db,
        schemas.ConversationCreate(
            name="The Fellowship",
            is_group=True,
            member_ids=[alice.id, bob.id, charlie.id, dana.id]
        )
    )

    # 5. Seed Messages & Receipts for Alice <-> Bob
    msg_1 = crud.create_message(
        db,
        schemas.MessageCreate(
            conversation_id=conv_alice_bob.id,
            content="Hey Alice, did you check out the new Signal Clone?"
        ),
        sender_id=bob.id
    )
    # Set status as read for Alice since she will have "seen" it in our mock history
    crud.update_message_status(db, msg_1.id, alice.id, "read")

    msg_2 = crud.create_message(
        db,
        schemas.MessageCreate(
            conversation_id=conv_alice_bob.id,
            content="Yes! The real-time WebSockets and reactions are super smooth."
        ),
        sender_id=alice.id
    )
    crud.update_message_status(db, msg_2.id, bob.id, "read")

    msg_3 = crud.create_message(
        db,
        schemas.MessageCreate(
            conversation_id=conv_alice_bob.id,
            content="Awesome! Let's test typing indicators and attachments next."
        ),
        sender_id=bob.id
    )
    # Leave as "delivered" (unread indicator will show for Alice)
    crud.update_message_status(db, msg_3.id, alice.id, "delivered")

    # 6. Seed Messages for Group
    gmsg_1 = crud.create_message(
        db,
        schemas.MessageCreate(
            conversation_id=conv_fellowship.id,
            content="Welcome to the group everyone!"
        ),
        sender_id=alice.id
    )
    crud.update_message_status(db, gmsg_1.id, bob.id, "read")
    crud.update_message_status(db, gmsg_1.id, charlie.id, "read")
    crud.update_message_status(db, gmsg_1.id, dana.id, "delivered")

    gmsg_2 = crud.create_message(
        db,
        schemas.MessageCreate(
            conversation_id=conv_fellowship.id,
            content="Hey Alice, thanks for adding me!"
        ),
        sender_id=charlie.id
    )
    crud.update_message_status(db, gmsg_2.id, alice.id, "read")
    crud.update_message_status(db, gmsg_2.id, bob.id, "read")
    crud.update_message_status(db, gmsg_2.id, dana.id, "delivered")

    gmsg_3 = crud.create_message(
        db,
        schemas.MessageCreate(
            conversation_id=conv_fellowship.id,
            content="Checking in! Happy to see this working.",
            is_disappearing=True,
            disappear_after=30
        ),
        sender_id=dana.id
    )
    crud.update_message_status(db, gmsg_3.id, alice.id, "read")
    crud.update_message_status(db, gmsg_3.id, bob.id, "delivered")
    crud.update_message_status(db, gmsg_3.id, charlie.id, "delivered")

    # Add reaction to Alice's message in the group
    crud.add_message_reaction(db, gmsg_1.id, bob.id, "👍")
    crud.add_message_reaction(db, gmsg_1.id, charlie.id, "❤️")

    db.commit()
    print("Database seeding completed.")

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
