from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.activity import QuizAttempt, SavedStudyPlan
from app.models.chat_session import ChatMessage, ChatSession
from app.models.user import User
from app.schemas.dashboard import (
    Achievement,
    ActivityItem,
    DashboardStats,
    PeriodProgress,
    UpcomingExam,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

RECENT_ACTIVITY_LIMIT = 6
UPCOMING_EXAMS_LIMIT = 5

# --- XP economy -------------------------------------------------------------
# Deliberately simple and disclosed here rather than buried: XP is earned
# from three sources. There's no way to "spend" or lose XP.
XP_PER_CORRECT_ANSWER = 10   # per correct answer in a completed quiz
XP_PER_CHAT_MESSAGE = 2      # per message YOU send to the tutor
XP_PER_STUDY_PLAN = 25       # per study plan generated and saved

# --- Levels ------------------------------------------------------------------
# Flat 100 XP per level, with a title that changes every few levels. Simple
# and easy to reason about, not tuned against any real usage data.
XP_PER_LEVEL = 100
LEVEL_TITLES = [
    (1, "Beginner"),
    (3, "Learner"),
    (6, "Scholar"),
    (11, "Achiever"),
    (21, "Master"),
]


def _naive_utc_now() -> datetime:
    """
    Datetimes read back from SQLite come back naive (no tzinfo), even though
    they were written from timezone-aware values -- comparing a naive value
    against an aware `datetime.now(timezone.utc)` raises a TypeError. This
    returns the same wall-clock instant, just without tzinfo, so it can be
    safely compared against values read from the database.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _current_streak(activity_dates: set[date]) -> int:
    """
    Counts consecutive days of activity ending at the most recent active day
    (today or yesterday -- a day without any activity yet doesn't reset the
    streak until tomorrow, matching how most streak trackers behave).
    Returns 0 if there's no activity at all, or none recent enough to count.
    """
    if not activity_dates:
        return 0

    today = date.today()
    anchor = today if today in activity_dates else today - timedelta(days=1)
    if anchor not in activity_dates:
        return 0

    streak = 0
    cursor = anchor
    while cursor in activity_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def _level_title(level: int) -> str:
    title = LEVEL_TITLES[0][1]
    for threshold, name in LEVEL_TITLES:
        if level >= threshold:
            title = name
    return title


def _xp_for(quiz_attempts: list[QuizAttempt], user_message_count: int, plan_count: int) -> int:
    quiz_xp = sum(a.score * XP_PER_CORRECT_ANSWER for a in quiz_attempts)
    chat_xp = user_message_count * XP_PER_CHAT_MESSAGE
    plan_xp = plan_count * XP_PER_STUDY_PLAN
    return quiz_xp + chat_xp + plan_xp


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.id).all()
    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == current_user.id)
        .order_by(QuizAttempt.created_at.desc())
        .all()
    )
    plans = (
        db.query(SavedStudyPlan)
        .filter(SavedStudyPlan.user_id == current_user.id)
        .order_by(SavedStudyPlan.created_at.desc())
        .all()
    )
    user_messages = (
        db.query(ChatMessage)
        .join(ChatSession, ChatMessage.session_id == ChatSession.id)
        .filter(ChatSession.user_id == current_user.id, ChatMessage.role == "user")
        .all()
    )

    # --- Streak --------------------------------------------------------
    activity_dates: set[date] = set()
    activity_dates.update(s.updated_at.date() for s in sessions)
    activity_dates.update(a.created_at.date() for a in attempts)
    activity_dates.update(p.created_at.date() for p in plans)
    streak_days = _current_streak(activity_dates)

    # --- Quiz stats ------------------------------------------------------
    quizzes_completed = len(attempts)
    average_score_percent = (
        round(sum((a.score / a.total_questions) * 100 for a in attempts) / quizzes_completed, 1)
        if quizzes_completed
        else None
    )
    quiz_time_seconds = sum(a.time_taken_seconds for a in attempts)

    # --- Total study time (an ESTIMATE, not a precise measurement) ------
    # Quiz time is exact (we time it). Chat time has no real duration
    # tracking, so each learner message is credited as roughly 2 minutes of
    # study time -- a documented estimate, not a measurement. Study plans
    # contribute nothing here since they describe FUTURE hours, not time
    # already spent.
    total_study_minutes = (quiz_time_seconds // 60) + (len(user_messages) * 2)

    # --- XP & level ------------------------------------------------------
    xp = _xp_for(attempts, len(user_messages), len(plans))
    level = xp // XP_PER_LEVEL + 1
    xp_into_level = xp % XP_PER_LEVEL
    level_title = _level_title(level)

    # --- Weekly / monthly progress ---------------------------------------
    now = _naive_utc_now()

    def _period_progress(since: datetime) -> PeriodProgress:
        period_attempts = [a for a in attempts if a.created_at >= since]
        period_messages = [m for m in user_messages if m.created_at >= since]
        period_plans = [p for p in plans if p.created_at >= since]
        return PeriodProgress(
            quizzes_completed=len(period_attempts),
            xp_earned=_xp_for(period_attempts, len(period_messages), len(period_plans)),
        )

    weekly_progress = _period_progress(now - timedelta(days=7))
    monthly_progress = _period_progress(now - timedelta(days=30))

    # --- Achievements ------------------------------------------------------
    has_perfect_score = any(a.score == a.total_questions for a in attempts)
    achievements = [
        Achievement(
            id="first_quiz",
            label="First Quiz",
            description="Complete your first quiz",
            unlocked=quizzes_completed >= 1,
        ),
        Achievement(
            id="quiz_enthusiast",
            label="Quiz Enthusiast",
            description="Complete 10 quizzes",
            unlocked=quizzes_completed >= 10,
        ),
        Achievement(
            id="perfect_score",
            label="Perfect Score",
            description="Get every question right on a quiz",
            unlocked=has_perfect_score,
        ),
        Achievement(
            id="three_day_streak",
            label="3-Day Streak",
            description="Stay active for 3 days in a row",
            unlocked=streak_days >= 3,
        ),
        Achievement(
            id="week_streak",
            label="7-Day Streak",
            description="Stay active for a full week",
            unlocked=streak_days >= 7,
        ),
        Achievement(
            id="planner_pro",
            label="Planner Pro",
            description="Generate your first study plan",
            unlocked=len(plans) >= 1,
        ),
        Achievement(
            id="curious_mind",
            label="Curious Mind",
            description="Start 10 conversations with the tutor",
            unlocked=len(sessions) >= 10,
        ),
        Achievement(
            id="xp_rookie",
            label="XP Rookie",
            description="Earn 100 XP",
            unlocked=xp >= 100,
        ),
        Achievement(
            id="xp_master",
            label="XP Master",
            description="Earn 1000 XP",
            unlocked=xp >= 1000,
        ),
    ]

    # --- Upcoming exams ------------------------------------------------
    today = date.today()
    upcoming_exams = [
        UpcomingExam(subjects=p.subjects, exam_date=p.exam_date, days_until=(p.exam_date - today).days)
        for p in plans
        if p.exam_date >= today
    ]
    upcoming_exams.sort(key=lambda e: e.exam_date)
    upcoming_exams = upcoming_exams[:UPCOMING_EXAMS_LIMIT]

    # --- Recent activity feed --------------------------------------------
    activity_items = (
        [
            ActivityItem(
                type="chat",
                description=f"Chatted about \u201c{s.title}\u201d" if s.title else "Started a new chat",
                timestamp=s.updated_at,
            )
            for s in sessions
        ]
        + [
            ActivityItem(
                type="quiz",
                description=f"Scored {a.score}/{a.total_questions} on a {a.subject} quiz",
                timestamp=a.created_at,
            )
            for a in attempts
        ]
        + [
            ActivityItem(
                type="study_plan",
                description=f"Generated a study plan for {p.subjects}",
                timestamp=p.created_at,
            )
            for p in plans
        ]
    )
    activity_items.sort(key=lambda item: item.timestamp, reverse=True)

    return DashboardStats(
        streak_days=streak_days,
        quizzes_completed=quizzes_completed,
        average_score_percent=average_score_percent,
        quiz_time_seconds=quiz_time_seconds,
        total_study_minutes=total_study_minutes,
        xp=xp,
        level=level,
        level_title=level_title,
        xp_into_level=xp_into_level,
        xp_for_next_level=XP_PER_LEVEL,
        weekly_progress=weekly_progress,
        monthly_progress=monthly_progress,
        achievements=achievements,
        upcoming_exams=upcoming_exams,
        recent_activity=activity_items[:RECENT_ACTIVITY_LIMIT],
    )
