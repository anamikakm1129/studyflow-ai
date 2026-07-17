from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class QuizRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=100)
    topic: str = Field(..., min_length=1, max_length=100)
    difficulty: Literal["easy", "medium", "hard"]
    num_questions: int = Field(..., ge=1, le=20)


class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    correct_index: int
    explanation: str | None = None


class QuizResponse(BaseModel):
    subject: str
    topic: str
    difficulty: str
    questions: list[QuizQuestion]


class QuizAttemptIn(BaseModel):
    subject: str = Field(..., min_length=1, max_length=100)
    topic: str = Field(..., min_length=1, max_length=100)
    difficulty: str
    score: int = Field(..., ge=0)
    total_questions: int = Field(..., ge=1)
    time_taken_seconds: int = Field(..., ge=0)


class QuizAttemptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject: str
    topic: str
    difficulty: str
    score: int
    total_questions: int
    time_taken_seconds: int
    created_at: datetime
