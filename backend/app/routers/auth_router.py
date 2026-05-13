from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_user, get_db
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserRead
from app.services.auth_service import authenticate_user, register_user

router = APIRouter(prefix="/auth")


@router.post("/register", response_model=UserRead, status_code=201)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> UserRead:
    try:
        user = await register_user(db, email=str(payload.email), password=payload.password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    return UserRead.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await authenticate_user(db, email=str(payload.email), password=payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(
        secret_key=settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
        user_id=user.id,
        expires_in=settings.access_token_expires_in,
    )
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserRead)
async def me(user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(user)
