from pydantic import BaseModel, Field
from typing import List, Optional
import datetime

# --- USER SCHEMAS ---
# Base model for shared User properties across API payloads
class UserBase(BaseModel):
    username: Optional[str] = None
    phone: Optional[str] = None
    display_name: str
    avatar_url: Optional[str] = None

class UserCreate(UserBase):
    pass

class UserResponse(UserBase):
    id: int
    is_online: bool
    last_seen: datetime.datetime
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None

# --- AUTH SCHEMAS ---
class LoginRequest(BaseModel):
    phone: Optional[str] = None
    username: Optional[str] = None

class OTPVerifyRequest(BaseModel):
    phone: Optional[str] = None
    username: Optional[str] = None
    otp: str

class LoginResponse(BaseModel):
    user: UserResponse
    token: str

# --- CONTACT SCHEMAS ---
# Model representing a user's contact book entry
class ContactCreate(BaseModel):
    contact_phone_or_username: str

class ContactResponse(BaseModel):
    id: int
    user_id: int
    contact_user: UserResponse
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# --- REACTION SCHEMAS ---
class MessageReactionBase(BaseModel):
    reaction: str

class MessageReactionResponse(MessageReactionBase):
    id: int
    message_id: int
    user_id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# --- STATUS SCHEMAS ---
class MessageStatusResponse(BaseModel):
    id: int
    message_id: int
    user_id: int
    status: str
    updated_at: datetime.datetime

    class Config:
        from_attributes = True

# --- MESSAGE SCHEMAS ---
# Model representing an individual chat message, including reactions and read status
class MessageCreate(BaseModel):
    conversation_id: int
    content: str
    message_type: Optional[str] = "text"
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    reply_to_id: Optional[int] = None
    is_disappearing: Optional[bool] = False
    disappear_after: Optional[int] = None # in seconds

class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: Optional[int] = None
    content: str
    message_type: str
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    reply_to_id: Optional[int] = None
    is_disappearing: bool
    disappear_after: Optional[int] = None
    created_at: datetime.datetime
    statuses: List[MessageStatusResponse] = []
    reactions: List[MessageReactionResponse] = []

    class Config:
        from_attributes = True

# --- CONVERSATION SCHEMAS ---
# Model representing a conversation (group or 1:1) and its metadata
class ConversationMemberResponse(BaseModel):
    id: int
    user_id: int
    role: str
    joined_at: datetime.datetime
    user: UserResponse

    class Config:
        from_attributes = True

class ConversationResponse(BaseModel):
    id: int
    name: Optional[str] = None
    is_group: bool
    avatar_url: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    members: List[ConversationMemberResponse] = []
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0

    class Config:
        from_attributes = True

class ConversationCreate(BaseModel):
    name: Optional[str] = None # Empty for direct chats
    is_group: bool = False
    avatar_url: Optional[str] = None
    member_ids: List[int] # List of user IDs to include in the conversation

class AddMemberRequest(BaseModel):
    user_id: int
    role: Optional[str] = "member"
