from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import crud, schemas, models
from .auth import get_current_user

# Contacts Router: Handles adding and listing a user's address book contacts
router = APIRouter(prefix="/contacts", tags=["contacts"])

@router.get("/", response_model=List[schemas.ContactResponse])
def get_user_contacts(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_contacts(db, user_id=current_user.id)

@router.post("/", response_model=schemas.ContactResponse)
def add_new_contact(
    request: schemas.ContactCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Find contact user
    contact_user = crud.get_user_by_phone_or_username(db, request.contact_phone_or_username)
    if not contact_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found with this phone number or username."
        )
        
    if contact_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot add yourself as a contact."
        )
        
    # Add contact for both users to create a mutual connection (Signal style)
    db_contact = crud.add_contact(db, user_id=current_user.id, contact_id=contact_user.id)
    crud.add_contact(db, user_id=contact_user.id, contact_id=current_user.id)
    
    return db_contact
