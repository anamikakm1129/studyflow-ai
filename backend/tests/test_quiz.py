from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


def _register_and_login(client, email, password="testpass123"):
    client.post("/api/auth/register", json={"email": email, "password": password})
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    return resp.json()["token"]


MOCK_QUESTIONS = [
    {
        "question": "What is the powerhouse of the cell?",
        "options": ["Nucleus", "Mitochondria", "Ribosome", "Golgi apparatus"],
        "correct_index": 1,
        "explanation": "Mitochondria produce ATP through cellular respiration.",
    },
    {
        "question": "What gas do plants absorb from the atmosphere?",
        "options": ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"],
        "correct_index": 2,
        "explanation": "Plants use CO2 during photosynthesis.",
    },
]


@patch("app.api.routes.quiz.generate_quiz", return_value=MOCK_QUESTIONS)
def test_create_quiz_returns_parsed_questions(mock_generate):
    with TestClient(app) as client:
        token = _register_and_login(client, email="quiztaker@example.com")
        resp = client.post(
            "/api/quiz/generate",
            json={
                "subject": "Biology",
                "topic": "Cell structure",
                "difficulty": "easy",
                "num_questions": 2,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["subject"] == "Biology"
        assert body["difficulty"] == "easy"
        assert len(body["questions"]) == 2
        assert body["questions"][0]["correct_index"] == 1
        mock_generate.assert_called_once_with(
            subject="Biology", topic="Cell structure", difficulty="easy", num_questions=2
        )


def test_create_quiz_requires_auth():
    with TestClient(app) as client:
        resp = client.post(
            "/api/quiz/generate",
            json={"subject": "Math", "topic": "Algebra", "difficulty": "medium", "num_questions": 5},
        )
        assert resp.status_code == 401


def test_create_quiz_rejects_invalid_difficulty():
    with TestClient(app) as client:
        token = _register_and_login(client, email="quizvalidation@example.com")
        resp = client.post(
            "/api/quiz/generate",
            json={"subject": "Math", "topic": "Algebra", "difficulty": "impossible", "num_questions": 5},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422


def test_create_quiz_surfaces_generation_error():
    from app.services.gemini_client import QuizGenerationError

    with TestClient(app) as client:
        token = _register_and_login(client, email="quizerror@example.com")

        with patch(
            "app.api.routes.quiz.generate_quiz",
            side_effect=QuizGenerationError("The quiz service is temporarily unavailable."),
        ):
            resp = client.post(
                "/api/quiz/generate",
                json={"subject": "Math", "topic": "Algebra", "difficulty": "medium", "num_questions": 5},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 502
