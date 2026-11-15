from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings, validate_database_url

# Project root = OCTOLOOP/ (parents: database.py -> core -> app -> backend -> OCTOLOOP)
PROJECT_ROOT = Path(__file__).resolve().parents[3]

# V2: validate DATABASE_URL at startup (fail fast with clear message).
validate_database_url(settings.DATABASE_URL)


def _resolve_database_url(url: str) -> str:
    """Resolve relative sqlite paths to absolute under OCTOLOOP/ so the DB file
    always lands at OCTOLOOP/database/octoloop.db regardless of working dir.
    PostgreSQL URLs pass through unchanged."""
    if url.startswith("sqlite:///./"):
        rel = url[len("sqlite:///./"):]
        abs_path = (PROJECT_ROOT / rel).resolve()
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{abs_path}"
    return url


DATABASE_URL = _resolve_database_url(settings.DATABASE_URL)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
