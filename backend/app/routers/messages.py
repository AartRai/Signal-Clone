from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy.orm import Session
from typing import List
import os
import uuid
import shutil

from ..database import get_db
from .. import crud, schemas, models
from .auth import get_current_user
from ..websocket_manager import manager

# Messages Router: Handles REST fallback for retrieving message history and adding reactions
router = APIRouter(prefix="/messages", tags=["messages"])

@router.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user)
):
    # Generate a unique filename to prevent collisions
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join("uploads", unique_filename)
    
    # Save the file to the uploads directory
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Return the full URL
    base_url = str(request.base_url).rstrip('/')
    # If the app is behind a proxy (like Render) we usually get https, but let's just construct it
    # We can rely on request.base_url which FastAPI handles well
    return {"url": f"{base_url}/uploads/{unique_filename}"}

@router.get("/conversation/{conversation_id}", response_model=List[schemas.MessageResponse])
def get_messages_for_conversation(
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
        
    return crud.get_conversation_messages(db, conversation_id=conversation_id, user_id=current_user.id)

@router.post("/", response_model=schemas.MessageResponse)
def send_rest_message(
    request: schemas.MessageCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = crud.get_conversation(db, conversation_id=request.conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    is_member = any(m.user_id == current_user.id for m in conv.members)
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")
        
    db_msg = crud.create_message(db, request, sender_id=current_user.id)
    
    # Broadcast message to all online conversation members
    member_ids = [m.user_id for m in conv.members]
    msg_res = schemas.MessageResponse.model_validate(db_msg)
    
    import asyncio
    asyncio.create_task(
        manager.broadcast_to_users(
            {"event": "new_message", "data": msg_res.model_dump(mode='json')},
            member_ids
        )
    )
    
    return msg_res

@router.post("/{message_id}/react", response_model=schemas.MessageReactionResponse)
def add_reaction(
    message_id: int,
    request: schemas.MessageReactionBase,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    msg = crud.get_message(db, message_id=message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
        
    # Check membership in conversation
    conv = crud.get_conversation(db, conversation_id=msg.conversation_id)
    is_member = any(m.user_id == current_user.id for m in conv.members)
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")
        
    db_reaction = crud.add_message_reaction(
        db, message_id=message_id, user_id=current_user.id, reaction=request.reaction
    )
    
    # Broadcast reaction update
    member_ids = [m.user_id for m in conv.members]
    reaction_res = schemas.MessageReactionResponse.model_validate(db_reaction)
    
    import asyncio
    asyncio.create_task(
        manager.broadcast_to_users(
            {
                "event": "reaction_update",
                "data": {
                    "message_id": message_id,
                    "conversation_id": msg.conversation_id,
                    "reaction": reaction_res.model_dump(mode='json'),
                    "action": "add"
                }
            },
            member_ids
        )
    )
    
    return db_reaction

@router.delete("/{message_id}/react")
def remove_reaction(
    message_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    msg = crud.get_message(db, message_id=message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
        
    conv = crud.get_conversation(db, conversation_id=msg.conversation_id)
    is_member = any(m.user_id == current_user.id for m in conv.members)
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")
        
    success = crud.remove_message_reaction(db, message_id=message_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Reaction not found")
        
    # Broadcast reaction deletion
    member_ids = [m.user_id for m in conv.members]
    
    import asyncio
    asyncio.create_task(
        manager.broadcast_to_users(
            {
                "event": "reaction_update",
                "data": {
                    "message_id": message_id,
                    "conversation_id": msg.conversation_id,
                    "reaction": {
                        "message_id": message_id,
                        "user_id": current_user.id
                    },
                    "action": "remove"
                }
            },
            member_ids
        )
    )
    
    return {"message": "Reaction removed successfully"}
