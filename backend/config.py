import logging
import os
import secrets
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DEFAULT_DB_PATH = BASE_DIR / "data" / "pm.db"

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "openai/gpt-oss-120b:free"

SESSION_COOKIE_NAME = "pm_session"
SESSION_SECRET = os.getenv("PM_SESSION_SECRET") or secrets.token_hex(32)
COOKIE_SECURE = os.getenv("PM_COOKIE_SECURE", "false").lower() == "true"

DEMO_USERNAME = "user"
DEMO_PASSWORD = "password"

logger = logging.getLogger("pm")
