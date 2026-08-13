from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer
import datetime
from typing import Optional

from ..database import get_db
from .. import crud, schemas, models

import os

# Auth Router: Handles login, registration, and JWT token management
router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.getenv("SIGNAL_CLONE_JWT_SECRET", "default_insecure_secret_key_change_in_production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 week token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

# Helper function to generate JWT access tokens for authenticated users
def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Dependency to retrieve the currently authenticated user from the JWT token
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception
        
    user = crud.get_user(db, user_id=user_id)
    if user is None:
        raise credentials_exception
    return user

@router.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if phone or username already exists
    if user.phone:
        db_user = crud.get_user_by_phone(db, phone=user.phone)
        if db_user:
            raise HTTPException(status_code=400, detail="Phone number already registered")
    if user.username:
        db_user = crud.get_user_by_username(db, username=user.username)
        if db_user:
            raise HTTPException(status_code=400, detail="Username already registered")
            
    if not user.phone and not user.username:
        raise HTTPException(status_code=400, detail="Must provide username or phone number")
        
    return crud.create_user(db=db, user=user)

@router.post("/login")
def login(request: schemas.LoginRequest, db: Session = Depends(get_db)):
    identifier = request.phone or request.username
    if not identifier:
        raise HTTPException(status_code=400, detail="Must provide phone or username")
        
    user = crud.get_user_by_phone_or_username(db, identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please register first.")
        
    # Return verification status indicating OTP was sent
    return {"message": "OTP sent successfully. Verify with OTP 123456", "identifier": identifier}

@router.post("/verify-otp", response_model=schemas.LoginResponse)
def verify_otp(request: schemas.OTPVerifyRequest, db: Session = Depends(get_db)):
    identifier = request.phone or request.username
    if not identifier:
        raise HTTPException(status_code=400, detail="Must provide phone or username")
        
    if request.otp != "123456":
        raise HTTPException(status_code=400, detail="Invalid OTP code. Use mock code 123456")
        
    user = crud.get_user_by_phone_or_username(db, identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Mark user as online
    crud.set_user_presence(db, user.id, is_online=True)
    
    access_token_expires = datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    
    return {"user": user, "token": access_token}

@router.get("/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@router.post("/logout")
def logout(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    crud.set_user_presence(db, current_user.id, is_online=False)
    return {"message": "Logged out successfully"}
