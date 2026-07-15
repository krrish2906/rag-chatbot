import os
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.schemas.auth import (
    RegisterSchema,
    LoginSchema
)

from app.models.user import User
from app.db.session import get_db
from app.core.security import get_current_user

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token
)

router = APIRouter(
    prefix="/auth",
    tags=["Auth"]
)

@router.post("/register")
def register_user(
    user: RegisterSchema,
    db: Session = Depends(get_db)
):
    existing_user = db.query(User).filter(
        User.email == user.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already exists"
        )

    hashed_pw = hash_password(user.password)

    new_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_pw
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "User registered successfully"
    }

@router.post("/login")
def login_user(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    existing_user = db.query(User).filter(
        User.email == form_data.username
    ).first()

    if not existing_user:
        raise HTTPException(
            status_code=400,
            detail="Invalid credentials"
        )

    valid_password = verify_password(
        form_data.password,
        existing_user.hashed_password
    )

    if not valid_password:
        raise HTTPException(
            status_code=400,
            detail="Invalid credentials"
        )

    access_token = create_access_token(
        data={
            "user_id": existing_user.id,
            "email": existing_user.email
        }
    )

    cookie_secure = os.getenv("COOKIE_SECURE", "False").lower() in ("true", "1", "yes")
    cookie_samesite = os.getenv("COOKIE_SAMESITE", "lax")

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=cookie_secure,
        samesite=cookie_samesite,
        max_age=2 * 24 * 60 * 60  # 2 days
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": existing_user.id,
            "username": existing_user.username,
            "email": existing_user.email,
        },
    }

@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email
    }

@router.post("/logout")
def logout_user(response: Response):
    cookie_samesite = os.getenv("COOKIE_SAMESITE", "lax")
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite=cookie_samesite,
    )
    return {"message": "Logged out successfully"}