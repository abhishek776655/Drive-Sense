from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def create_access_token(
    *,
    secret_key: str,
    algorithm: str,
    user_id: uuid.UUID,
    expires_in: timedelta,
    additional_claims: dict[str, Any] | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "user_id": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + expires_in).timestamp()),
    }
    if additional_claims:
        payload.update(additional_claims)
    return jwt.encode(payload, secret_key, algorithm=algorithm)


def decode_access_token(*, token: str, secret_key: str, algorithm: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, secret_key, algorithms=[algorithm])
    except JWTError as e:
        raise ValueError("Invalid token") from e

    user_id = payload.get("user_id")
    if not user_id:
        raise ValueError("Token missing user_id")
    try:
        uuid.UUID(str(user_id))
    except ValueError as e:
        raise ValueError("Invalid user_id in token") from e

    return payload

