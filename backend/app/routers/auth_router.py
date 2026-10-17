from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_user, get_db
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.auth import DeleteAccountRequest, LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import HandleAvailability, ProfileUpdate, UserRead
from app.schemas.vehicle import VehiclePhotoUpload
from app.services.auth_service import AccountTaken, authenticate_user, delete_account, register_user
from app.services.profile_service import EmailTaken, HandleTaken, get_avatar, handle_availability, set_avatar, update_profile
from app.services.vehicle_service import decode_photo, photo_media_type

router = APIRouter(prefix="/auth")


@router.post("/register", response_model=UserRead, status_code=201)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> UserRead:
    try:
        user = await register_user(
            db,
            handle=payload.handle,
            password=payload.password,
            email=str(payload.email) if payload.email else None,
        )
    except AccountTaken as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
    return UserRead.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await authenticate_user(db, login=payload.login, password=payload.password)
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


@router.delete("/me", status_code=204, response_model=None)
async def delete_me(
    payload: DeleteAccountRequest = Body(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    # 403, not 401: the session is fine, only the confirmation was wrong (a 401 signs the app out).
    if not await delete_account(db, user=user, password=payload.password):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Wrong password")


@router.get("/handle-available", response_model=HandleAvailability)
async def check_handle(
    handle: str = Query(min_length=1, max_length=40),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HandleAvailability:
    normalised, available, reason = await handle_availability(db, user_id=user.id, raw=handle)
    return HandleAvailability(handle=normalised, available=available, reason=reason)


@router.get("/handle-check", response_model=HandleAvailability)
async def check_handle_signup(
    handle: str = Query(min_length=1, max_length=40),
    db: AsyncSession = Depends(get_db),
) -> HandleAvailability:
    """Availability while signing up, before there is an account (and so no token)."""
    normalised, available, reason = await handle_availability(db, user_id=None, raw=handle)
    return HandleAvailability(handle=normalised, available=available, reason=reason)


@router.patch("/me", response_model=UserRead)
async def update_me(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserRead:
    try:
        updated = await update_profile(
            db,
            user=user,
            handle=payload.handle,
            email=str(payload.email) if payload.email else None,
            driving_frequency=payload.driving_frequency,
            weekly_goal=payload.weekly_goal,
            accept_terms=payload.accept_terms,
        )
    except HandleTaken as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That handle is taken") from exc
    except EmailTaken as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That email is taken") from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return UserRead.model_validate(updated)


@router.get("/me/avatar", response_class=Response)
async def my_avatar(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> Response:
    photo = await get_avatar(db, user_id=user.id)
    if photo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No photo")
    return Response(content=photo, media_type=photo_media_type(photo), headers={"Cache-Control": "private, max-age=31536000, immutable"})


@router.put("/me/avatar", response_model=UserRead)
async def put_avatar(
    payload: VehiclePhotoUpload,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserRead:
    try:
        raw, _ = decode_photo(payload.data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return UserRead.model_validate(await set_avatar(db, user=user, photo=raw))


@router.delete("/me/avatar", response_model=UserRead)
async def delete_avatar(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> UserRead:
    return UserRead.model_validate(await set_avatar(db, user=user, photo=None))
