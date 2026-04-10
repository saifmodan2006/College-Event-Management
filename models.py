from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func

from sqlalchemy.orm import Mapped, mapped_column

from db import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("google_sub", name="uq_users_google_sub"),
        UniqueConstraint("email", name="uq_users_email"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Google subject (stable user id in ID token)
    google_sub: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    email: Mapped[str | None] = mapped_column(String(320), nullable=True, index=True)
    email_verified: Mapped[str | None] = mapped_column(String(10), nullable=True)  # "true"/"false" from token

    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    given_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    family_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    picture: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[str] = mapped_column(String(10), nullable=False)   # "YYYY-MM-DD"
    time: Mapped[str] = mapped_column(String(5), nullable=False)    # "HH:MM"
    venue: Mapped[str] = mapped_column(String(500), nullable=False)
    duration: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "2 hours"

    event_type: Mapped[str | None] = mapped_column(String(100), nullable=True)

    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    entry_fees: Mapped[float | None] = mapped_column(Float, nullable=True)  # only set when is_paid=True
    prize: Mapped[str | None] = mapped_column(String(500), nullable=True)
    registration_link: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class EventInterest(Base):
    __tablename__ = "event_interests"
    __table_args__ = (
        UniqueConstraint("user_id", "event_id", name="uq_event_interest"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    event_id: Mapped[int] = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class EventAttendance(Base):
    __tablename__ = "event_attendance"
    __table_args__ = (
        UniqueConstraint("user_id", "event_id", name="uq_event_attendance"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    event_id: Mapped[int] = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    attended: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    marked_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

