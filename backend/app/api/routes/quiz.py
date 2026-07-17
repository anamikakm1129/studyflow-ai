from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.activity import QuizAttempt
from app.models.user import User
from app.schemas.quiz import QuizAttemptIn, QuizAttemptOut, QuizQuestion, QuizRequest, QuizResponse
from app.services.gemini_client import QuizGenerationError, generate_quiz

router = APIRouter(prefix="/quiz", tags=["quiz"])


@router.post("/generate", response_model=QuizResponse)
def create_quiz(
    payload: QuizRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        raw_questions = generate_quiz(
            subject=payload.subject,
            topic=payload.topic,
            difficulty=payload.difficulty,
            num_questions=payload.num_questions,
        )
    except QuizGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    # Parse defensively: skip any malformed question rather than failing the
    # whole quiz over one bad item from the model.
    questions: list[QuizQuestion] = []
    for q in raw_questions:
        try:
            questions.append(
                QuizQuestion(
                    question=q["question"],
                    options=q["options"],
                    correct_index=q["correct_index"],
                    explanation=q.get("explanation"),
                )
            )
        except (KeyError, TypeError):
            continue

    if not questions:
        raise HTTPException(status_code=502, detail="The quiz service returned an unusable quiz. Please try again.")

    return QuizResponse(
        subject=payload.subject,
        topic=payload.topic,
        difficulty=payload.difficulty,
        questions=questions,
    )


@router.post("/attempts", response_model=QuizAttemptOut, status_code=201)
def save_quiz_attempt(
    payload: QuizAttemptIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Records a completed quiz attempt. Called once, after the learner submits
    their answers -- this is what makes "quizzes completed" and average
    score on the dashboard real numbers instead of sample data.
    """
    attempt = QuizAttempt(
        user_id=current_user.id,
        subject=payload.subject,
        topic=payload.topic,
        difficulty=payload.difficulty,
        score=payload.score,
        total_questions=payload.total_questions,
        time_taken_seconds=payload.time_taken_seconds,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


@router.get("/attempts", response_model=list[QuizAttemptOut])
def list_quiz_attempts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists this user's past quiz attempts, most recent first."""
    return (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == current_user.id)
        .order_by(QuizAttempt.created_at.desc())
        .all()
    )
