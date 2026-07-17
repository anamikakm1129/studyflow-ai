from pydantic import BaseModel, Field


class FlashcardRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=8000)
    count: int = Field(default=8, ge=1, le=20)


class Flashcard(BaseModel):
    front: str
    back: str


class FlashcardResponse(BaseModel):
    cards: list[Flashcard]


class NotesRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=8000)


class NotesResponse(BaseModel):
    notes: str
