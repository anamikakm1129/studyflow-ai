import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.activity import SavedStudyPlan
from app.models.user import User
from app.schemas.study_plan import (
    SavedStudyPlanIn,
    SavedStudyPlanOut,
    StudyDayPlan,
    StudyPlanRequest,
    StudyPlanResponse,
    StudySession,
)
from app.services.gemini_client import StudyPlanGenerationError, generate_study_plan

router = APIRouter(prefix="/planner", tags=["planner"])

MAX_PLAN_HORIZON_DAYS = 90


@router.post("/generate", response_model=StudyPlanResponse)
def create_study_plan(
    payload: StudyPlanRequest,
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    days_until_exam = (payload.exam_date - today).days

    if days_until_exam < 0:
        raise HTTPException(status_code=400, detail="Exam date must be today or in the future.")
    if days_until_exam > MAX_PLAN_HORIZON_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"The study planner supports exams up to {MAX_PLAN_HORIZON_DAYS} days out. Please choose a nearer date.",
        )

    try:
        raw_plan = generate_study_plan(
            subjects=payload.subjects,
            today=today.isoformat(),
            exam_date=payload.exam_date.isoformat(),
            available_hours_per_day=payload.available_hours_per_day,
        )
    except StudyPlanGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    # Parse defensively: skip any malformed day rather than failing the whole
    # plan over one bad item from the model.
    days: list[StudyDayPlan] = []
    for raw_day in raw_plan.get("days", []):
        try:
            sessions = [
                StudySession(subject=s["subject"], hours=s["hours"], focus=s["focus"])
                for s in raw_day.get("sessions", [])
            ]
            days.append(
                StudyDayPlan(
                    date=raw_day["date"],
                    sessions=sessions,
                    total_hours=raw_day.get("total_hours", sum(s.hours for s in sessions)),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue

    if not days:
        raise HTTPException(status_code=502, detail="The planner service returned an unusable timetable. Please try again.")

    return StudyPlanResponse(
        subjects=payload.subjects,
        exam_date=payload.exam_date,
        available_hours_per_day=payload.available_hours_per_day,
        summary=raw_plan.get("summary", ""),
        days=days,
    )


@router.post("/plans", response_model=SavedStudyPlanOut, status_code=201)
def save_study_plan(
    payload: SavedStudyPlanIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Saves a generated study plan. Called once, right after the planner
    wizard finishes -- this is what makes "upcoming exams" on the dashboard
    real data instead of sample data.
    """
    plan = SavedStudyPlan(
        user_id=current_user.id,
        subjects=", ".join(payload.subjects),
        exam_date=payload.exam_date,
        hours_per_day=payload.hours_per_day,
        summary=payload.summary,
        plan_json=json.dumps([d.model_dump(mode="json") for d in payload.days]),
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/plans", response_model=list[SavedStudyPlanOut])
def list_study_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists this user's saved study plans, most recent first."""
    return (
        db.query(SavedStudyPlan)
        .filter(SavedStudyPlan.user_id == current_user.id)
        .order_by(SavedStudyPlan.created_at.desc())
        .all()
    )
