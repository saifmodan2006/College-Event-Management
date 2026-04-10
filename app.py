from __future__ import annotations

import os
import smtplib
import threading
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from functools import wraps

import jwt
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy import delete, select

from db import SessionLocal, init_db
from models import Event, EventAttendance, EventInterest, User


RUPEE_SYMBOL = "\u20B9"


def _format_inr(value: float | None) -> str:
    if value is None:
        return f"{RUPEE_SYMBOL}0"

    amount = f"{value:.2f}".rstrip("0").rstrip(".")
    return f"{RUPEE_SYMBOL}{amount}"


def _parse_entry_fees(is_paid: bool, raw_fees: object) -> tuple[float | None, str | None]:
    if not is_paid:
        return None, None

    if raw_fees is None or str(raw_fees).strip() == "":
        return None, "entry_fees is required for paid events"

    try:
        entry_fees = float(raw_fees)
    except (TypeError, ValueError):
        return None, "entry_fees must be a non-negative number"

    if entry_fees < 0:
        return None, "entry_fees must be a non-negative number"

    return entry_fees, None


def _parse_event_date(raw_date: object) -> tuple[str | None, datetime | None, str | None]:
    date_str = str(raw_date or "").strip()
    if not date_str:
        return None, None, "date is required"

    try:
        parsed = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return None, None, "date must be in YYYY-MM-DD format"

    current_year = datetime.now().year
    if parsed.year < current_year - 5:
        suggested_year = current_year
        return (
            None,
            None,
            f"Event year looks incorrect: {date_str}. If this is a new event, use {suggested_year}{date_str[4:]} instead.",
        )

    return date_str, parsed, None


def send_event_notification(event_dict: dict, user_emails: list[str]) -> None:
    """Send event details to all users via Gmail SMTP."""
    sender_email = os.getenv("SENDER_EMAIL")
    app_password = os.getenv("APP_PASSWORD")

    if not sender_email or not app_password:
        print("Warning: SENDER_EMAIL or APP_PASSWORD not set. Skipping email notification.")
        return

    if not user_emails:
        return

    subject = f"New Event: {event_dict['name']}"

    # Build email body
    body_lines = [
        f"Hello!",
        f"",
        f"A new event has been added:",
        f"",
        f"Event: {event_dict['name']}",
        f"Date: {event_dict['date']}",
        f"Time: {event_dict['time']}",
        f"Venue: {event_dict['venue']}",
        f"Duration: {event_dict['duration']}",
    ]

    if event_dict.get('event_type'):
        body_lines.append(f"Type: {event_dict['event_type']}")

    if event_dict.get('is_paid'):
        body_lines.append(f"Entry Fee: {_format_inr(event_dict.get('entry_fees'))}")
    else:
        body_lines.append("Entry: Free")

    if event_dict.get('prize'):
        body_lines.append(f"Prize: {event_dict['prize']}")

    if event_dict.get('registration_link'):
        body_lines.append(f"Registration Link: {event_dict['registration_link']}")

    body_lines.extend([
        f"",
        f"We look forward to seeing you there!",
        f"",
        f"Best regards,",
        f"Event Team"
    ])

    body = "\n".join(body_lines)

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(sender_email, app_password)

            for recipient_email in user_emails:
                msg = MIMEMultipart()
                msg["From"] = sender_email
                msg["To"] = recipient_email
                msg["Subject"] = subject
                msg.attach(MIMEText(body, "plain"))
                server.sendmail(sender_email, recipient_email, msg.as_string())

        print(f"Event notification sent to {len(user_emails)} user(s)")
    except Exception as e:
        print(f"Failed to send email notification: {e}")

load_dotenv()  # loads .env from the project root


def _jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET environment variable is not set")
    return secret


def _make_jwt(user: User) -> str:
    """Issue a signed JWT containing user identity and role."""
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
        "is_admin": user.is_admin,
        "iat": datetime.now(tz=timezone.utc),
        "exp": datetime.now(tz=timezone.utc) + timedelta(hours=8),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256")


def jwt_required(f):
    """Decorator that validates the Bearer JWT on protected routes."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401
        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, _jwt_secret(), algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        request.current_user = payload
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Decorator that additionally requires is_admin == True."""
    @wraps(f)
    @jwt_required
    def decorated(*args, **kwargs):
        if not request.current_user.get("is_admin"):
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated


def create_app() -> Flask:
    app = Flask(__name__)

    default_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    configured_origins = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "").split(",")
        if origin.strip()
    ]
    allowed_origins = configured_origins or default_origins

    CORS(
        app,
        resources={r"/api/*": {"origins": allowed_origins}},
        supports_credentials=True,
    )

    init_db()

    @app.get("/health")
    def health():
        return jsonify({"ok": True})

    @app.post("/api/auth/google")
    def auth_google():
        body = request.get_json(silent=True) or {}
        token = body.get("token")
        if not token or not isinstance(token, str):
            return jsonify({"error": "Missing 'token'"}), 400

        client_id = os.getenv("GOOGLE_CLIENT_ID")
        if not client_id:
            return jsonify({"error": "Server not configured: GOOGLE_CLIENT_ID is missing"}), 500

        try:
            idinfo = id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                audience=client_id,
            )
        except Exception:
            # Avoid leaking token / verification internals
            return jsonify({"error": "Invalid Google token"}), 401

        google_sub = idinfo.get("sub")
        if not google_sub:
            return jsonify({"error": "Invalid Google token payload"}), 401

        email = idinfo.get("email")

        # Determine admin status by comparing email (case-insensitive)
        admin_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
        is_admin = bool(admin_email and email and email.strip().lower() == admin_email)

        with SessionLocal() as session:
            user = session.scalar(select(User).where(User.google_sub == google_sub))
            created = False

            if user is None:
                user = User(
                    google_sub=google_sub,
                    email=email,
                    email_verified=str(idinfo.get("email_verified")) if idinfo.get("email_verified") is not None else None,
                    name=idinfo.get("name"),
                    given_name=idinfo.get("given_name"),
                    family_name=idinfo.get("family_name"),
                    picture=idinfo.get("picture"),
                    is_admin=is_admin,
                )
                session.add(user)
                created = True
            else:
                # Keep fields reasonably fresh
                user.email = email or user.email
                user.email_verified = (
                    str(idinfo.get("email_verified"))
                    if idinfo.get("email_verified") is not None
                    else user.email_verified
                )
                user.name = idinfo.get("name") or user.name
                user.given_name = idinfo.get("given_name") or user.given_name
                user.family_name = idinfo.get("family_name") or user.family_name
                user.picture = idinfo.get("picture") or user.picture
                # Re-evaluate admin status on every login (ADMIN_EMAIL can change)
                user.is_admin = is_admin

            session.commit()
            session.refresh(user)

        # Issue JWT so the client can authenticate subsequent requests
        access_token = _make_jwt(user)

        return (
            jsonify(
                {
                    "created": created,
                    "access_token": access_token,
                    "role": "admin" if user.is_admin else "user",
                    "user": {
                        "id": user.id,
                        "google_sub": user.google_sub,
                        "email": user.email,
                        "name": user.name,
                        "given_name": user.given_name,
                        "family_name": user.family_name,
                        "picture": user.picture,
                        "is_admin": user.is_admin,
                    },
                }
            ),
            200,
        )

    @app.get("/api/admin/dashboard")
    @admin_required
    def admin_dashboard():
        return jsonify({"message": "Welcome to the admin dashboard", "user": request.current_user})

    @app.get("/api/user/profile")
    @jwt_required
    def user_profile():
        return jsonify({"message": "Welcome to your profile", "user": request.current_user})

    # ── Event helpers ────────────────────────────────────────────────────────

    def _event_to_dict(event: Event) -> dict:
        return {
            "id": event.id,
            "name": event.name,
            "date": event.date,
            "time": event.time,
            "venue": event.venue,
            "duration": event.duration,
            "event_type": event.event_type,
            "is_paid": event.is_paid,
            "entry_fees": event.entry_fees,
            "prize": event.prize,
            "registration_link": event.registration_link,
            "created_by": event.created_by,
            "created_at": event.created_at.isoformat() if event.created_at else None,
            "updated_at": event.updated_at.isoformat() if event.updated_at else None,
        }

    # ── Public/user event routes ─────────────────────────────────────────────

    @app.get("/api/events")
    @jwt_required
    def list_events_user():
        """Return all events sorted by date/time for regular users."""
        with SessionLocal() as session:
            events = session.scalars(select(Event).order_by(Event.date, Event.time)).all()
            return jsonify([_event_to_dict(e) for e in events])

    @app.get("/api/events/my-interests")
    @jwt_required
    def my_interests():
        """Return event IDs the current user has marked as interested."""
        user_id = int(request.current_user["sub"])
        with SessionLocal() as session:
            rows = session.scalars(
                select(EventInterest.event_id).where(EventInterest.user_id == user_id)
            ).all()
            return jsonify(list(rows))

    @app.post("/api/events/<int:event_id>/interest")
    @jwt_required
    def toggle_interest(event_id: int):
        """Toggle the current user's interest in an event."""
        user_id = int(request.current_user["sub"])
        with SessionLocal() as session:
            existing = session.scalar(
                select(EventInterest).where(
                    EventInterest.user_id == user_id,
                    EventInterest.event_id == event_id,
                )
            )
            if existing:
                session.delete(existing)
                session.commit()
                return jsonify({"interested": False})
            else:
                # Verify event exists
                event = session.get(Event, event_id)
                if not event:
                    return jsonify({"error": "Event not found"}), 404
                session.add(EventInterest(user_id=user_id, event_id=event_id))
                session.commit()
                return jsonify({"interested": True})

    # ── Event CRUD routes (all require admin JWT) ─────────────────────────────

    @app.post("/api/admin/events")
    @admin_required
    def create_event():
        body = request.get_json(silent=True) or {}
        required = ["name", "date", "time", "venue", "duration"]
        missing = [f for f in required if not body.get(f)]
        if missing:
            return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

        is_paid = bool(body.get("is_paid", False))
        entry_fees, error = _parse_entry_fees(is_paid, body.get("entry_fees"))
        if error:
            return jsonify({"error": error}), 400
        event_date, _, error = _parse_event_date(body.get("date"))
        if error:
            return jsonify({"error": error}), 400

        event = Event(
            name=body["name"].strip(),
            date=event_date,
            time=body["time"].strip(),
            venue=body["venue"].strip(),
            duration=body["duration"].strip(),
            event_type=body.get("event_type", "").strip() or None,
            is_paid=is_paid,
            entry_fees=entry_fees,
            prize=body.get("prize", "").strip() or None,
            registration_link=body.get("registration_link", "").strip() or None,
            created_by=int(request.current_user["sub"]),
        )
        with SessionLocal() as session:
            session.add(event)
            session.commit()
            session.refresh(event)

            # Fetch all user emails and send notification
            users = session.scalars(select(User.email).where(User.email.isnot(None))).all()
            user_emails = [email for email in users if email]

            # Prepare event data dict for the response and email notification
            event_dict = _event_to_dict(event)

        # Send email notification in background (don't block response)
        # Pass event_dict instead of event object since session is closed
        threading.Thread(
            target=send_event_notification,
            args=(event_dict, user_emails),
            daemon=True
        ).start()

        return jsonify(event_dict), 201

    @app.get("/api/admin/interests")
    @admin_required
    def list_interests():
        """Return all event interests with user and event details."""
        with SessionLocal() as session:
            rows = session.execute(
                select(
                    EventInterest.id,
                    EventInterest.event_id,
                    EventInterest.user_id,
                    EventInterest.created_at,
                    Event.name.label("event_name"),
                    Event.date.label("event_date"),
                    Event.time.label("event_time"),
                    Event.event_type,
                    User.name.label("user_name"),
                    User.email.label("user_email"),
                    User.picture.label("user_picture"),
                ).join(Event, EventInterest.event_id == Event.id)
                .join(User, EventInterest.user_id == User.id)
                .order_by(Event.date, Event.time, User.name)
            ).all()
            return jsonify([
                {
                    "id": r.id,
                    "event_id": r.event_id,
                    "event_name": r.event_name,
                    "event_date": r.event_date,
                    "event_time": r.event_time,
                    "event_type": r.event_type,
                    "user_id": r.user_id,
                    "user_name": r.user_name,
                    "user_email": r.user_email,
                    "user_picture": r.user_picture,
                    "registered_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ])

    @app.get("/api/admin/events")
    @admin_required
    def list_events():
        with SessionLocal() as session:
            events = session.scalars(select(Event).order_by(Event.date, Event.time)).all()
            return jsonify([_event_to_dict(e) for e in events])

    @app.get("/api/admin/events/<int:event_id>")
    @admin_required
    def get_event(event_id: int):
        with SessionLocal() as session:
            event = session.get(Event, event_id)
            if not event:
                return jsonify({"error": "Event not found"}), 404
            return jsonify(_event_to_dict(event))

    @app.put("/api/admin/events/<int:event_id>")
    @admin_required
    def update_event(event_id: int):
        body = request.get_json(silent=True) or {}
        with SessionLocal() as session:
            event = session.get(Event, event_id)
            if not event:
                return jsonify({"error": "Event not found"}), 404

            next_is_paid = bool(body["is_paid"]) if "is_paid" in body else event.is_paid
            raw_entry_fees = body["entry_fees"] if "entry_fees" in body else event.entry_fees
            entry_fees, error = _parse_entry_fees(next_is_paid, raw_entry_fees)
            if error:
                return jsonify({"error": error}), 400
            if "date" in body:
                validated_date, _, error = _parse_event_date(body["date"])
                if error:
                    return jsonify({"error": error}), 400
                body["date"] = validated_date

            updatable = ["name", "date", "time", "venue", "duration", "event_type", "prize", "registration_link"]
            nullable_text_fields = {"event_type", "prize", "registration_link"}
            for field in updatable:
                if field not in body:
                    continue

                value = body[field]
                if isinstance(value, str):
                    value = value.strip()
                    if field in nullable_text_fields:
                        value = value or None

                setattr(event, field, value)

            event.is_paid = next_is_paid
            event.entry_fees = entry_fees

            session.commit()
            session.refresh(event)
            return jsonify(_event_to_dict(event))

    @app.delete("/api/admin/events/<int:event_id>")
    @admin_required
    def delete_event(event_id: int):
        with SessionLocal() as session:
            event = session.get(Event, event_id)
            if not event:
                return jsonify({"error": "Event not found"}), 404

            session.execute(delete(EventAttendance).where(EventAttendance.event_id == event_id))
            session.execute(delete(EventInterest).where(EventInterest.event_id == event_id))
            session.delete(event)
            session.commit()
            return jsonify({"deleted": event_id})

    # ── Event Attendance routes (admin only) ─────────────────────────────────

    @app.get("/api/admin/events/<int:event_id>/attendance")
    @admin_required
    def get_event_attendance(event_id: int):
        """Get attendance list for a specific event with all non-admin users."""
        with SessionLocal() as session:
            event = session.get(Event, event_id)
            if not event:
                return jsonify({"error": "Event not found"}), 404

            users = session.execute(
                select(
                    User.id,
                    User.name,
                    User.email,
                    User.picture,
                )
                .where(User.is_admin.is_(False))
                .order_by(User.name, User.email)
            ).all()

            interest_rows = session.execute(
                select(EventInterest.user_id, EventInterest.created_at).where(EventInterest.event_id == event_id)
            ).all()
            interest_map = {row.user_id: row.created_at for row in interest_rows}

            attendance_records = session.scalars(
                select(EventAttendance).where(EventAttendance.event_id == event_id)
            ).all()
            attendance_map = {a.user_id: a for a in attendance_records}

            return jsonify([
                {
                    "user_id": u.id,
                    "user_name": u.name,
                    "user_email": u.email,
                    "user_picture": u.picture,
                    "interested": u.id in interest_map,
                    "registered_at": interest_map[u.id].isoformat() if u.id in interest_map else None,
                    "attended": attendance_map.get(u.id).attended if u.id in attendance_map else False,
                    "marked_at": attendance_map.get(u.id).updated_at.isoformat() if u.id in attendance_map else None,
                    "marked_by": attendance_map.get(u.id).marked_by if u.id in attendance_map else None,
                }
                for u in users
            ])

    @app.post("/api/admin/events/<int:event_id>/attendance/<int:user_id>")
    @admin_required
    def mark_attendance(event_id: int, user_id: int):
        """Mark a user as attended for an event."""
        admin_id = int(request.current_user["sub"])
        with SessionLocal() as session:
            event = session.get(Event, event_id)
            if not event:
                return jsonify({"error": "Event not found"}), 404

            user = session.get(User, user_id)
            if not user:
                return jsonify({"error": "User not found"}), 404
            if user.is_admin:
                return jsonify({"error": "Admin users cannot be marked as attendees"}), 400

            existing = session.scalar(
                select(EventAttendance).where(
                    EventAttendance.user_id == user_id,
                    EventAttendance.event_id == event_id,
                )
            )

            if existing:
                existing.attended = True
                existing.marked_by = admin_id
                session.commit()
                return jsonify({"attended": True, "updated": True})
            else:
                attendance = EventAttendance(
                    user_id=user_id,
                    event_id=event_id,
                    attended=True,
                    marked_by=admin_id,
                )
                session.add(attendance)
                session.commit()
                return jsonify({"attended": True, "created": True})

    @app.delete("/api/admin/events/<int:event_id>/attendance/<int:user_id>")
    @admin_required
    def unmark_attendance(event_id: int, user_id: int):
        """Remove attendance mark for a user."""
        with SessionLocal() as session:
            attendance = session.scalar(
                select(EventAttendance).where(
                    EventAttendance.user_id == user_id,
                    EventAttendance.event_id == event_id,
                )
            )
            if attendance:
                session.delete(attendance)
                session.commit()
                return jsonify({"attended": False, "deleted": True})
            return jsonify({"attended": False, "deleted": False})

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "5000")), debug=True)
