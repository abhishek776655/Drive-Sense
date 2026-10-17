from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, model_validator


class RegisterRequest(BaseModel):
    """Sign-up is a handle and a password; email is an optional recovery address."""

    handle: str = Field(min_length=1, max_length=40)
    password: str = Field(min_length=8, max_length=256)
    email: EmailStr | None = None


class LoginRequest(BaseModel):
    """`identifier` is a handle or an email. `email` is the older field, still accepted."""

    identifier: str | None = Field(default=None, min_length=1, max_length=320)
    email: str | None = Field(default=None, min_length=1, max_length=320)
    password: str = Field(min_length=1, max_length=256)

    @model_validator(mode="after")
    def _needs_identifier(self) -> "LoginRequest":
        if not (self.identifier or self.email):
            raise ValueError("identifier is required")
        return self

    @property
    def login(self) -> str:
        return (self.identifier or self.email or "").strip()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"



class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1, max_length=256)
