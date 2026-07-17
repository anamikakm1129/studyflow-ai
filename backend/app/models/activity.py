from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class QuizAttempt(Base):
    """
    A completed quiz, recorded once the learner submits their answers.
    Powers the dashboard's "quizzes completed", average score, and recent
    activity -- none of which had any real data behind them before this.
    """

    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    topic: Mapped[str] = mapped_column(String, nullable=False)
    difficulty: Mapped[str] = mapped_column(String, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    time_taken_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class SavedStudyPlan(Base):
    """
    A generated study plan, saved once the learner finishes the planner
    wizard. Powers the dashboard's "upcoming exams" widget. The full
    day-by-day schedule is kept (as JSON text) so a future "view my saved
    plans" page can render it without regenerating from Gemini.
    """

    __tablename__ = "study_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    subjects: Mapped[str] = mapped_column(String, nullable=False)  # comma-joined for simplicity
    exam_date: Mapped[date] = mapped_column(Date, nullable=False)
    hours_per_day: Mapped[float] = mapped_column(Float, nullable=False)
    summary: Mapped[str] = mapped_column(String, nullable=False)
    plan_json: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
