from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.tools import Flashcard, FlashcardRequest, FlashcardResponse, NotesRequest, NotesResponse
from app.services.gemini_client import (
    FlashcardGenerationError,
    NotesGenerationError,
    generate_flashcards,
    generate_notes,
)

router = APIRouter(prefix="/tools", tags=["tools"])


@router.post("/flashcards", response_model=FlashcardResponse)
def create_flashcards(
    payload: FlashcardRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        raw_cards = generate_flashcards(content=payload.content, count=payload.count)
    except FlashcardGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    # Parse defensively: skip any malformed card rather than failing the
    # whole set over one bad item from the model.
    cards: list[Flashcard] = []
    for c in raw_cards:
        try:
            cards.append(Flashcard(front=c["front"], back=c["back"]))
        except (KeyError, TypeError):
            continue

    if not cards:
        raise HTTPException(status_code=502, detail="The flashcard service returned unusable cards. Please try again.")

    return FlashcardResponse(cards=cards)


@router.post("/notes", response_model=NotesResponse)
def create_notes(
    payload: NotesRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        notes = generate_notes(content=payload.content)
    except NotesGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return NotesResponse(notes=notes)
