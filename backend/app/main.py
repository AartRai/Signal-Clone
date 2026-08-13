from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import json
import logging

from .database import engine, Base, SessionLocal
from .websocket_manager import manager
from .seed import seed_database
from . import crud, schemas
from .routers import auth, contacts, conversations, messages

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

# Initialize database tables on startup
Base.metadata.create_all(bind=engine)
# Seed the database with initial users and conversations
db = SessionLocal()
try:
    seed_database(db)
finally:
    db.close()

# Main FastAPI application instance
app = FastAPI(title="Signal Clone API", version="1.0.0")

# CORS setup for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount REST routers
app.include_router(auth.router)
app.include_router(contacts.router)
app.include_router(conversations.router)
app.include_router(messages.router)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Signal Clone Backend API is running"}

# Core WebSocket endpoint handling real-time bidirectional communication with the client
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    # Establish connection
    await manager.connect(user_id, websocket)
    
    # Update presence status to online
    with SessionLocal() as db:
        crud.set_user_presence(db, user_id, is_online=True)
        # Broadcast presence update to contacts
        contacts = crud.get_contacts(db, user_id)
        contact_ids = [c.contact_id for c in contacts]
        
    await manager.broadcast_to_users(
        {
            "event": "presence",
            "data": {
                "user_id": user_id,
                "is_online": True
            }
        },
        contact_ids
    )

    try:
        while True:
            # Wait for message from client
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                event = payload.get("event")
                event_data = payload.get("data", {})
                
                logger.info(f"Received WS event '{event}' from user {user_id}")
                
                if event == "typing":
                    conversation_id = event_data.get("conversation_id")
                    is_typing = event_data.get("is_typing", False)
                    
                    if conversation_id:
                        with SessionLocal() as db:
                            conv = crud.get_conversation(db, conversation_id)
                            if conv:
                                member_ids = [m.user_id for m in conv.members if m.user_id != user_id]
                                await manager.broadcast_to_users(
                                    {
                                        "event": "typing",
                                        "data": {
                                            "conversation_id": conversation_id,
                                            "user_id": user_id,
                                            "is_typing": is_typing
                                        }
                                    },
                                    member_ids
                                )
                                
                elif event == "read":
                    conversation_id = event_data.get("conversation_id")
                    if conversation_id:
                        with SessionLocal() as db:
                            marked = crud.mark_conversation_as_read(db, conversation_id, user_id)
                            conv = crud.get_conversation(db, conversation_id)
                            if conv and marked > 0:
                                member_ids = [m.user_id for m in conv.members if m.user_id != user_id]
                                await manager.broadcast_to_users(
                                    {
                                        "event": "read_receipt",
                                        "data": {
                                            "conversation_id": conversation_id,
                                            "user_id": user_id,
                                            "status": "read"
                                        }
                                    },
                                    member_ids
                                )
                                
                elif event == "send_message":
                    conversation_id = event_data.get("conversation_id")
                    content = event_data.get("content")
                    message_type = event_data.get("message_type", "text")
                    attachment_url = event_data.get("attachment_url")
                    attachment_type = event_data.get("attachment_type")
                    reply_to_id = event_data.get("reply_to_id")
                    is_disappearing = event_data.get("is_disappearing", False)
                    disappear_after = event_data.get("disappear_after")
                    
                    if conversation_id and content:
                        with SessionLocal() as db:
                            msg_in = schemas.MessageCreate(
                                conversation_id=conversation_id,
                                content=content,
                                message_type=message_type,
                                attachment_url=attachment_url,
                                attachment_type=attachment_type,
                                reply_to_id=reply_to_id,
                                is_disappearing=is_disappearing,
                                disappear_after=disappear_after
                            )
                            db_msg = crud.create_message(db, msg_in, sender_id=user_id)
                            msg_res = schemas.MessageResponse.model_validate(db_msg)
                            
                            conv = crud.get_conversation(db, conversation_id)
                            member_ids = [m.user_id for m in conv.members] if conv else [user_id]
                            
                        # Broadcast message to all members of the conversation
                        await manager.broadcast_to_users(
                            {
                                "event": "new_message",
                                "data": msg_res.model_dump(mode='json')
                            },
                            member_ids
                        )
                        
            except json.JSONDecodeError:
                logger.error("Failed to decode JSON from WebSocket payload")
            except Exception as e:
                logger.error(f"Error handling socket payload: {e}")
                
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
        
        # Set presence status to offline
        with SessionLocal() as db:
            crud.set_user_presence(db, user_id, is_online=False)
            contacts = crud.get_contacts(db, user_id)
            contact_ids = [c.contact_id for c in contacts]
            
        # Broadcast offline presence status
        await manager.broadcast_to_users(
            {
                "event": "presence",
                "data": {
                    "user_id": user_id,
                    "is_online": False
                }
            },
            contact_ids
        )
