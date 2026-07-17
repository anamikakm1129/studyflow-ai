from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


def _register_and_login(client, email, password="testpass123"):
    client.post("/api/auth/register", json={"email": email, "password": password})
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    return resp.json()["token"]


MOCK_CARDS = [
    {"front": "What is mitosis?", "back": "Cell division producing two identical daughter cells."},
    {"front": "What is meiosis?", "back": "Cell division producing four genetically distinct gametes."},
]


@patch("app.api.routes.tools.generate_flashcards", return_value=MOCK_CARDS)
def test_create_flashcards_returns_parsed_cards(mock_generate):
    with TestClient(app) as client:
        token = _register_and_login(client, "flashcarduser@example.com")
        resp = client.post(
            "/api/tools/flashcards",
            json={"content": "Mitosis and meiosis are both forms of cell division...", "count": 2},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["cards"]) == 2
        assert body["cards"][0]["front"] == "What is mitosis?"
        mock_generate.assert_called_once()


def test_create_flashcards_requires_auth():
    with TestClient(app) as client:
        resp = client.post("/api/tools/flashcards", json={"content": "some content", "count": 5})
        assert resp.status_code == 401


@patch("app.api.routes.tools.generate_flashcards")
def test_create_flashcards_surfaces_generation_error(mock_generate):
    from app.services.gemini_client import FlashcardGenerationError

    mock_generate.side_effect = FlashcardGenerationError("The flashcard service is temporarily unavailable.")
    with TestClient(app) as client:
        token = _register_and_login(client, "flashcarderror@example.com")
        resp = client.post(
            "/api/tools/flashcards",
            json={"content": "some content", "count": 5},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 502


@patch("app.api.routes.tools.generate_notes", return_value="# Cell Division\n\n- Mitosis: ...\n- Meiosis: ...")
def test_create_notes_returns_markdown(mock_generate):
    with TestClient(app) as client:
        token = _register_and_login(client, "notesuser@example.com")
        resp = client.post(
            "/api/tools/notes",
            json={"content": "Mitosis and meiosis are both forms of cell division..."},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert "Cell Division" in resp.json()["notes"]


def test_create_notes_requires_auth():
    with TestClient(app) as client:
        resp = client.post("/api/tools/notes", json={"content": "some content"})
        assert resp.status_code == 401
