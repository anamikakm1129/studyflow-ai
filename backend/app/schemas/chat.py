from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ChatMessageIn(BaseModel):
    message: str
    session_id: int | None = None


class ChatMessageOut(BaseModel):
    reply: str
    session_id: int
    message_id: int


class ChatMessagePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: str
    feedback: str | None = None
    created_at: datetime


class ChatHistoryOut(BaseModel):
    session_id: int
    messages: list[ChatMessagePublic]


class ChatSessionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str | None = None
    created_at: datetime
    updated_at: datetime


class MessageFeedbackIn(BaseModel):
    feedback: Literal["up", "down"] | None = None


class MessageFeedbackOut(BaseModel):
    id: int
    feedback: str | None = None
