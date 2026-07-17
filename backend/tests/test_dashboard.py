from datetime import date, timedelta
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


def _register_and_login(client, email, password="testpass123"):
    client.post("/api/auth/register", json={"email": email, "password": password})
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    return resp.json()["token"]


def test_dashboard_stats_empty_for_new_user():
    with TestClient(app) as client:
        token = _register_and_login(client, "dashnew@example.com")
        resp = client.get("/api/dashboard/stats", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["streak_days"] == 0
        assert body["quizzes_completed"] == 0
        assert body["average_score_percent"] is None
        assert body["upcoming_exams"] == []
        assert body["recent_activity"] == []


def test_quiz_attempt_save_and_appears_in_dashboard_stats():
    with TestClient(app) as client:
        token = _register_and_login(client, "dashquiz@example.com")

        save_resp = client.post(
            "/api/quiz/attempts",
            json={
                "subject": "Biology",
                "topic": "Cells",
                "difficulty": "medium",
                "score": 8,
                "total_questions": 10,
                "time_taken_seconds": 245,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert save_resp.status_code == 201

        stats = client.get("/api/dashboard/stats", headers={"Authorization": f"Bearer {token}"}).json()
        assert stats["quizzes_completed"] == 1
        assert stats["average_score_percent"] == 80.0
        assert stats["quiz_time_seconds"] == 245
        assert stats["streak_days"] == 1
        assert any("Biology" in item["description"] for item in stats["recent_activity"])


def test_quiz_attempts_isolated_per_user():
    with TestClient(app) as client:
        token_a = _register_and_login(client, "dashquizowner@example.com")
        token_b = _register_and_login(client, "dashquizother@example.com")

        client.post(
            "/api/quiz/attempts",
            json={"subject": "Math", "topic": "Algebra", "difficulty": "easy", "score": 5, "total_questions": 5, "time_taken_seconds": 60},
            headers={"Authorization": f"Bearer {token_a}"},
        )

        b_attempts = client.get("/api/quiz/attempts", headers={"Authorization": f"Bearer {token_b}"}).json()
        assert b_attempts == []

        b_stats = client.get("/api/dashboard/stats", headers={"Authorization": f"Bearer {token_b}"}).json()
        assert b_stats["quizzes_completed"] == 0


def test_study_plan_save_appears_in_upcoming_exams():
    with TestClient(app) as client:
        token = _register_and_login(client, "dashplan@example.com")
        future_date = (date.today() + timedelta(days=10)).isoformat()

        save_resp = client.post(
            "/api/planner/plans",
            json={
                "subjects": ["Physics", "Chemistry"],
                "exam_date": future_date,
                "hours_per_day": 3,
                "summary": "Balanced revision plan.",
                "days": [
                    {
                        "date": future_date,
                        "sessions": [{"subject": "Physics", "hours": 2, "focus": "Mechanics review"}],
                        "total_hours": 2,
                    }
                ],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert save_resp.status_code == 201
        assert save_resp.json()["subjects"] == "Physics, Chemistry"

        stats = client.get("/api/dashboard/stats", headers={"Authorization": f"Bearer {token}"}).json()
        assert len(stats["upcoming_exams"]) == 1
        assert stats["upcoming_exams"][0]["subjects"] == "Physics, Chemistry"
        assert stats["upcoming_exams"][0]["days_until"] == 10


def test_past_study_plan_not_shown_as_upcoming():
    with TestClient(app) as client:
        token = _register_and_login(client, "dashpastplan@example.com")
        past_date = (date.today() - timedelta(days=5)).isoformat()

        client.post(
            "/api/planner/plans",
            json={
                "subjects": ["History"],
                "exam_date": past_date,
                "hours_per_day": 2,
                "summary": "Already happened.",
                "days": [],
            },
            headers={"Authorization": f"Bearer {token}"},
        )

        stats = client.get("/api/dashboard/stats", headers={"Authorization": f"Bearer {token}"}).json()
        assert stats["upcoming_exams"] == []


@patch("app.api.routes.chat.generate_tutor_reply", return_value="hi")
def test_chat_activity_counts_toward_streak(mock_reply):
    with TestClient(app) as client:
        token = _register_and_login(client, "dashchat@example.com")
        client.post("/api/chat", json={"message": "hello"}, headers={"Authorization": f"Bearer {token}"})

        stats = client.get("/api/dashboard/stats", headers={"Authorization": f"Bearer {token}"}).json()
        assert stats["streak_days"] == 1
        assert any(item["type"] == "chat" for item in stats["recent_activity"])


def test_xp_and_level_from_quiz_and_plan():
    with TestClient(app) as client:
        token = _register_and_login(client, "dashxp@example.com")

        # 8/10 correct -> 8 * 10 = 80 XP from the quiz.
        client.post(
            "/api/quiz/attempts",
            json={"subject": "Bio", "topic": "Cells", "difficulty": "medium", "score": 8, "total_questions": 10, "time_taken_seconds": 100},
            headers={"Authorization": f"Bearer {token}"},
        )
        # +25 XP flat from the plan.
        future_date = (date.today() + timedelta(days=5)).isoformat()
        client.post(
            "/api/planner/plans",
            json={"subjects": ["Math"], "exam_date": future_date, "hours_per_day": 2, "summary": "s", "days": []},
            headers={"Authorization": f"Bearer {token}"},
        )

        stats = client.get("/api/dashboard/stats", headers={"Authorization": f"Bearer {token}"}).json()
        assert stats["xp"] == 105  # 80 (quiz) + 25 (plan) + 0 chat messages
        assert stats["level"] == 2  # 105 // 100 + 1
        assert stats["level_title"] == "Beginner"  # "Learner" doesn't start until level 3
        assert stats["xp_into_level"] == 5


def test_achievements_unlock_correctly():
    with TestClient(app) as client:
        token = _register_and_login(client, "dashachieve@example.com")

        # No activity yet -- nothing should be unlocked.
        stats = client.get("/api/dashboard/stats", headers={"Authorization": f"Bearer {token}"}).json()
        by_id = {a["id"]: a["unlocked"] for a in stats["achievements"]}
        assert by_id["first_quiz"] is False
        assert by_id["perfect_score"] is False

        # A perfect score unlocks both "first_quiz" and "perfect_score".
        client.post(
            "/api/quiz/attempts",
            json={"subject": "Math", "topic": "Algebra", "difficulty": "easy", "score": 5, "total_questions": 5, "time_taken_seconds": 60},
            headers={"Authorization": f"Bearer {token}"},
        )
        stats = client.get("/api/dashboard/stats", headers={"Authorization": f"Bearer {token}"}).json()
        by_id = {a["id"]: a["unlocked"] for a in stats["achievements"]}
        assert by_id["first_quiz"] is True
        assert by_id["perfect_score"] is True
        assert by_id["quiz_enthusiast"] is False  # needs 10, only has 1


def test_weekly_and_monthly_progress_reflect_recent_activity():
    with TestClient(app) as client:
        token = _register_and_login(client, "dashperiod@example.com")

        client.post(
            "/api/quiz/attempts",
            json={"subject": "Math", "topic": "Algebra", "difficulty": "easy", "score": 3, "total_questions": 5, "time_taken_seconds": 60},
            headers={"Authorization": f"Bearer {token}"},
        )

        stats = client.get("/api/dashboard/stats", headers={"Authorization": f"Bearer {token}"}).json()
        # An attempt made right now falls inside both the 7-day and 30-day windows.
        assert stats["weekly_progress"]["quizzes_completed"] == 1
        assert stats["weekly_progress"]["xp_earned"] == 30
        assert stats["monthly_progress"]["quizzes_completed"] == 1
        assert stats["monthly_progress"]["xp_earned"] == 30


def test_total_study_minutes_combines_quiz_time_and_chat_estimate():
    with TestClient(app) as client:
        token = _register_and_login(client, "dashminutes@example.com")

        client.post(
            "/api/quiz/attempts",
            json={"subject": "Math", "topic": "Algebra", "difficulty": "easy", "score": 1, "total_questions": 1, "time_taken_seconds": 120},
            headers={"Authorization": f"Bearer {token}"},
        )
        with patch("app.api.routes.chat.generate_tutor_reply", return_value="hi"):
            client.post("/api/chat", json={"message": "hello"}, headers={"Authorization": f"Bearer {token}"})

        stats = client.get("/api/dashboard/stats", headers={"Authorization": f"Bearer {token}"}).json()
        # 120s quiz time = 2 minutes, plus 1 user message * 2 estimated minutes = 4 total.
        assert stats["total_study_minutes"] == 4
