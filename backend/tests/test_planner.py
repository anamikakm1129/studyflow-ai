from datetime import date, timedelta
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


def _register_and_login(client, email, password="testpass123"):
    client.post("/api/auth/register", json={"email": email, "password": password})
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    return resp.json()["token"]


def _mock_plan(day1, day2):
    return {
        "summary": "Focus more on Chemistry early, taper into review before the exam.",
        "days": [
            {
                "date": day1,
                "sessions": [
                    {"subject": "Math", "hours": 1.5, "focus": "Practice problems: derivatives"},
                    {"subject": "Chemistry", "hours": 1.0, "focus": "Review: periodic trends"},
                ],
                "total_hours": 2.5,
            },
            {
                "date": day2,
                "sessions": [
                    {"subject": "Math", "hours": 1.0, "focus": "Timed mock quiz"},
                ],
                "total_hours": 1.0,
            },
        ],
    }


@patch("app.api.routes.planner.generate_study_plan")
def test_create_study_plan_returns_parsed_days(mock_generate):
    today = date.today()
    exam_date = today + timedelta(days=1)
    mock_generate.return_value = _mock_plan(today.isoformat(), exam_date.isoformat())

    with TestClient(app) as client:
        token = _register_and_login(client, email="planner@example.com")
        resp = client.post(
            "/api/planner/generate",
            json={
                "subjects": ["Math", "Chemistry"],
                "exam_date": exam_date.isoformat(),
                "available_hours_per_day": 3,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["subjects"] == ["Math", "Chemistry"]
        assert len(body["days"]) == 2
        assert body["days"][0]["sessions"][0]["subject"] == "Math"
        assert "summary" in body
        mock_generate.assert_called_once()


def test_create_study_plan_requires_auth():
    with TestClient(app) as client:
        resp = client.post(
            "/api/planner/generate",
            json={
                "subjects": ["Math"],
                "exam_date": (date.today() + timedelta(days=5)).isoformat(),
                "available_hours_per_day": 2,
            },
        )
        assert resp.status_code == 401


def test_create_study_plan_rejects_past_exam_date():
    with TestClient(app) as client:
        token = _register_and_login(client, email="pastdate@example.com")
        resp = client.post(
            "/api/planner/generate",
            json={
                "subjects": ["Math"],
                "exam_date": (date.today() - timedelta(days=1)).isoformat(),
                "available_hours_per_day": 2,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400


def test_create_study_plan_rejects_far_future_exam_date():
    with TestClient(app) as client:
        token = _register_and_login(client, email="fardate@example.com")
        resp = client.post(
            "/api/planner/generate",
            json={
                "subjects": ["Math"],
                "exam_date": (date.today() + timedelta(days=200)).isoformat(),
                "available_hours_per_day": 2,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400


def test_create_study_plan_surfaces_generation_error():
    from app.services.gemini_client import StudyPlanGenerationError

    with TestClient(app) as client:
        token = _register_and_login(client, email="plannererror@example.com")

        with patch(
            "app.api.routes.planner.generate_study_plan",
            side_effect=StudyPlanGenerationError("The planner service is temporarily unavailable."),
        ):
            resp = client.post(
                "/api/planner/generate",
                json={
                    "subjects": ["Math"],
                    "exam_date": (date.today() + timedelta(days=10)).isoformat(),
                    "available_hours_per_day": 2,
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 502
