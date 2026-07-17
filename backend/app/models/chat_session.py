from datetime import datetime, timezone

from sqlalchemy import Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    subject: Mapped[str | None] = mapped_column(String, nullable=True)
    # Auto-derived from the first user message in this session (see
    # app/api/routes/chat.py::_maybe_set_title). Nullable so old rows created
    # before this column existed don't break; the API falls back to
    # "New chat" for display when this is None.
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    # Bumped every time a message is added to this session, so the sidebar
    # can list conversations most-recently-active first.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.id"), nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)  # "user" or "assistant"
    content: Mapped[str] = mapped_column(String, nullable=False)
    # "up", "down", or None (no feedback / cleared). Only meaningful for
    # role="assistant" messages, but not DB-enforced -- the API only ever
    # sets it on assistant messages.
    feedback: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    session: Mapped["ChatSession"] = relationship(back_populates="messages")
