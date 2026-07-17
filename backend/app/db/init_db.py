from sqlalchemy import inspect, text

from app.db.session import engine, Base

# Models must be imported here so they're registered on Base.metadata
# before create_all() is called.
from app.models import user  # noqa: F401
from app.models import chat_session  # noqa: F401
from app.models import activity  # noqa: F401


def _migrate_chat_sessions_columns() -> None:
    """
    Lightweight, dependency-free migration for columns added after this
    project's initial schema (title/updated_at on chat_sessions, feedback
    on chat_messages).

    This project doesn't use Alembic (see the note on init_db() below), so
    Base.metadata.create_all() alone won't add new columns to a table that
    already exists from an earlier deployment -- it only creates tables that
    don't exist yet. Without this, an existing database would start raising
    "no such column" errors the moment this code shipped. Safe to run on
    every startup: each ALTER is skipped if the column is already present.
    """
    inspector = inspect(engine)

    with engine.begin() as conn:
        if "chat_sessions" in inspector.get_table_names():
            existing_columns = {col["name"] for col in inspector.get_columns("chat_sessions")}

            if "title" not in existing_columns:
                conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN title VARCHAR"))

            if "updated_at" not in existing_columns:
                conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN updated_at DATETIME"))
                # Backfill so existing rows sort sensibly instead of landing at
                # NULL (which would otherwise group them oddly in "most recently
                # active first" ordering).
                conn.execute(text("UPDATE chat_sessions SET updated_at = created_at WHERE updated_at IS NULL"))

        if "chat_messages" in inspector.get_table_names():
            existing_message_columns = {col["name"] for col in inspector.get_columns("chat_messages")}

            if "feedback" not in existing_message_columns:
                conn.execute(text("ALTER TABLE chat_messages ADD COLUMN feedback VARCHAR"))


def init_db() -> None:
    """
    Creates all tables defined by SQLAlchemy models, then applies any
    lightweight column migrations needed on top of an existing database.
    For a real production setup, replace this with Alembic migrations.
    """
    Base.metadata.create_all(bind=engine)
    _migrate_chat_sessions_columns()
