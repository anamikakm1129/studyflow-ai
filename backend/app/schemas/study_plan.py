from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class StudyPlanRequest(BaseModel):
    subjects: list[str] = Field(..., min_length=1, max_length=10)
    exam_date: date
    available_hours_per_day: float = Field(..., gt=0, le=16)


class StudySession(BaseModel):
    subject: str
    hours: float
    focus: str


class StudyDayPlan(BaseModel):
    date: date
    sessions: list[StudySession]
    total_hours: float


class StudyPlanResponse(BaseModel):
    subjects: list[str]
    exam_date: date
    available_hours_per_day: float
    summary: str
    days: list[StudyDayPlan]


class SavedStudyPlanIn(BaseModel):
    subjects: list[str]
    exam_date: date
    hours_per_day: float
    summary: str
    days: list[StudyDayPlan]


class SavedStudyPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subjects: str  # stored comma-joined; frontend can .split(', ')
    exam_date: date
    hours_per_day: float
    summary: str
    created_at: datetime
