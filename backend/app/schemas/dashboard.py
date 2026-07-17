from datetime import date, datetime

from pydantic import BaseModel


class UpcomingExam(BaseModel):
    subjects: str
    exam_date: date
    days_until: int


class ActivityItem(BaseModel):
    type: str  # "chat" | "quiz" | "study_plan"
    description: str
    timestamp: datetime


class PeriodProgress(BaseModel):
    quizzes_completed: int
    xp_earned: int


class Achievement(BaseModel):
    id: str
    label: str
    description: str
    unlocked: bool


class DashboardStats(BaseModel):
    streak_days: int
    quizzes_completed: int
    average_score_percent: float | None
    quiz_time_seconds: int
    total_study_minutes: int
    xp: int
    level: int
    level_title: str
    xp_into_level: int
    xp_for_next_level: int
    weekly_progress: PeriodProgress
    monthly_progress: PeriodProgress
    achievements: list[Achievement]
    upcoming_exams: list[UpcomingExam]
    recent_activity: list[ActivityItem]
