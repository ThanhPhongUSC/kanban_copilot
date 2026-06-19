from pathlib import Path

from fastapi import Cookie, FastAPI, HTTPException, Response
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
SESSION_COOKIE_NAME = "pm_session"
SESSION_COOKIE_VALUE = "authenticated"
DEMO_USERNAME = "user"
DEMO_PASSWORD = "password"

app = FastAPI(title="PM MVP Backend")


class LoginRequest(BaseModel):
    username: str
    password: str


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "pm-mvp-backend"}


@app.post("/api/auth/login")
def login(payload: LoginRequest, response: Response) -> dict[str, str]:
    if payload.username != DEMO_USERNAME or payload.password != DEMO_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=SESSION_COOKIE_VALUE,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )
    return {"status": "ok", "user": DEMO_USERNAME}


@app.post("/api/auth/logout")
def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"status": "ok"}


@app.get("/api/auth/session")
def session(pm_session: str | None = Cookie(default=None)) -> dict[str, str]:
    if pm_session != SESSION_COOKIE_VALUE:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"status": "ok", "user": DEMO_USERNAME}


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
