import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import SessionLocal, get_db
from app.models.chat_session import ChatMessage, ChatSession
from app.models.user import User
from app.schemas.chat import (
    ChatHistoryOut,
    ChatMessageIn,
    ChatMessageOut,
    ChatSessionSummary,
    MessageFeedbackIn,
    MessageFeedbackOut,
)
from app.services.gemini_client import TutorReplyError, generate_tutor_reply, stream_tutor_reply

router = APIRouter(prefix="/chat", tags=["chat"])

TITLE_MAX_LENGTH = 48


def _get_or_create_session(db: Session, payload: ChatMessageIn, user: User) -> ChatSession:
    """Reuses an existing session (validated to belong to this user), or starts a new one."""
    if payload.session_id:
        session = (
            db.query(ChatSession)
            .filter(ChatSession.id == payload.session_id, ChatSession.user_id == user.id)
            .first()
        )
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        return session

    session = ChatSession(user_id=user.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _history_for(session: ChatSession) -> list[dict]:
    """Prior turns in this session (oldest first), in the shape Claude expects."""
    return [
        {"role": m.role, "content": m.content}
        for m in sorted(session.messages, key=lambda m: m.created_at)
    ]


def _generate_title(message: str) -> str:
    """
    Derives a conversation title from the first user message, rather than
    making a separate AI call just to name the chat -- that would cost an
    extra Gemini request (and extra latency) for every new conversation,
    which isn't worth it for a title. Truncates to a clean length.
    """
    cleaned = " ".join(message.split())  # collapse newlines/repeated whitespace
    if len(cleaned) <= TITLE_MAX_LENGTH:
        return cleaned
    return cleaned[:TITLE_MAX_LENGTH].rstrip() + "…"


def _touch_session(session: ChatSession, first_message: str) -> None:
    """Bumps updated_at, and sets the title if this session doesn't have one yet."""
    session.updated_at = datetime.now(timezone.utc)
    if not session.title:
        session.title = _generate_title(first_message)


def _sse(event: str, data: dict) -> str:
    """Formats a single Server-Sent Events frame."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.get("/sessions", response_model=list[ChatSessionSummary])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists this user's conversations, most recently active first."""
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    return sessions


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    db.delete(session)  # cascades to its messages (see ChatSession.messages relationship)
    db.commit()


@router.post("", response_model=ChatMessageOut)
def send_message(
    payload: ChatMessageIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Non-streaming variant: waits for the full reply, then returns it in one response."""
    session = _get_or_create_session(db, payload, current_user)
    history = _history_for(session)

    user_message = ChatMessage(session_id=session.id, role="user", content=payload.message)
    db.add(user_message)
    _touch_session(session, payload.message)
    db.commit()

    try:
        reply_text = generate_tutor_reply(payload.message, history=history)
    except TutorReplyError as exc:
        # Surface a clean error to the client instead of a raw stack trace.
        # The user's message is already saved, so nothing is lost.
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    tutor_message = ChatMessage(session_id=session.id, role="assistant", content=reply_text)
    db.add(tutor_message)
    db.commit()
    db.refresh(tutor_message)

    return ChatMessageOut(reply=reply_text, session_id=session.id, message_id=tutor_message.id)


@router.post("/stream")
def stream_message(
    payload: ChatMessageIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Streaming variant: returns a text/event-stream response so the frontend
    can render Claude's reply token-by-token instead of waiting for the whole thing.

    Frames sent, in order:
      - "session": { session_id }              -- sent immediately, before any text
      - "chunk":   { text }                     -- one per text fragment, many of these
      - "done":    { session_id, message_id }   -- sent once the full reply is saved
      - "error":   { message }                  -- sent instead of "done" if something fails
    """
    session = _get_or_create_session(db, payload, current_user)
    history = _history_for(session)

    user_message = ChatMessage(session_id=session.id, role="user", content=payload.message)
    db.add(user_message)
    _touch_session(session, payload.message)
    db.commit()
    session_id = session.id

    def event_generator():
        # Uses its own DB session: this generator keeps running after the request
        # handler's dependency-injected `db` may have been torn down, since the
        # ASGI server streams the body over a longer-lived connection.
        stream_db = SessionLocal()
        full_reply_parts: list[str] = []

        yield _sse("session", {"session_id": session_id})

        try:
            for fragment in stream_tutor_reply(payload.message, history=history):
                full_reply_parts.append(fragment)
                yield _sse("chunk", {"text": fragment})
        except TutorReplyError as exc:
            yield _sse("error", {"message": str(exc)})
            stream_db.close()
            return

        full_reply = "".join(full_reply_parts).strip()
        message_id = None
        if full_reply:
            tutor_message = ChatMessage(session_id=session_id, role="assistant", content=full_reply)
            stream_db.add(tutor_message)
            stream_db.commit()
            stream_db.refresh(tutor_message)
            message_id = tutor_message.id

        yield _sse("done", {"session_id": session_id, "message_id": message_id})
        stream_db.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            # Prevent proxies/browsers from buffering the stream.
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.patch("/messages/{message_id}/feedback", response_model=MessageFeedbackOut)
def set_message_feedback(
    message_id: int,
    payload: MessageFeedbackIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Sets (or clears, if feedback is null) thumbs up/down on an assistant
    message. Ownership is verified by joining through the message's session,
    since ChatMessage itself has no direct user_id.
    """
    message = (
        db.query(ChatMessage)
        .join(ChatSession, ChatMessage.session_id == ChatSession.id)
        .filter(ChatMessage.id == message_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    message.feedback = payload.feedback
    db.commit()
    db.refresh(message)

    return MessageFeedbackOut(id=message.id, feedback=message.feedback)


@router.get("/history/{session_id}", response_model=ChatHistoryOut)
def get_history(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    return ChatHistoryOut(session_id=session.id, messages=session.messages)
