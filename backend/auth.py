import hashlib
import hmac

from fastapi import Cookie, HTTPException

from config import SESSION_SECRET
from database import get_user_id, open_connection


def _sign_username(username: str) -> str:
    return hmac.new(
        SESSION_SECRET.encode("utf-8"), username.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def make_session_token(username: str) -> str:
    return f"{username}:{_sign_username(username)}"


def verify_session_token(token: str | None) -> str | None:
    if not token:
        return None
    try:
        username, signature = token.rsplit(":", 1)
    except ValueError:
        return None
    if not username or not hmac.compare_digest(signature, _sign_username(username)):
        return None
    return username


def resolve_session_user(pm_session: str | None) -> str | None:
    username = verify_session_token(pm_session)
    if not username:
        return None
    with open_connection() as connection:
        user_id = get_user_id(connection, username)
    return username if user_id else None


def get_current_username(pm_session: str | None = Cookie(default=None)) -> str:
    username = resolve_session_user(pm_session)
    if not username:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return username
