from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


def _sqlite_url() -> str:
    # Default: local file in project directory
    return os.getenv("DATABASE_URL", "sqlite:///./app.db")


class Base(DeclarativeBase):
    pass


engine = create_engine(
    _sqlite_url(),
    connect_args={"check_same_thread": False} if _sqlite_url().startswith("sqlite:///") else {},
)

SessionLocal: sessionmaker[Session] = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    from models import User, Event, EventInterest, EventAttendance  # noqa: F401  (ensure models are imported)

    Base.metadata.create_all(bind=engine)
