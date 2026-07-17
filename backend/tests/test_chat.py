from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


def _register_and_login(client, email="learner@example.com", password="testpass123"):
    client.post("/api/auth/register", json={"email": email, "password": password})
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    return resp.json()["token"]


@patch("app.api.routes.chat.generate_tutor_reply", return_value="2 + 2 is 4.")
def test_send_message_returns_mocked_reply(mock_reply):
    with TestClient(app) as client:
        token = _register_and_login(client)
        resp = client.post(
            "/api/chat",
            json={"message": "What is 2+2?"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["reply"] == "2 + 2 is 4."
        assert "session_id" in body
        mock_reply.assert_called_once()


def test_send_message_requires_auth():
    with TestClient(app) as client:
        resp = client.post("/api/chat", json={"message": "Hello"})
        assert resp.status_code == 401


@patch("app.api.routes.chat.generate_tutor_reply", return_value="2 + 2 is 4.")
def test_new_session_gets_auto_generated_title(mock_reply):
    with TestClient(app) as client:
        token = _register_and_login(client, email="titletest@example.com")
        resp = client.post(
            "/api/chat",
            json={"message": "What is the difference between a list and a tuple in Python and when should I use each one"},
            headers={"Authorization": f"Bearer {token}"},
        )
        session_id = resp.json()["session_id"]

        sessions = client.get("/api/chat/sessions", headers={"Authorization": f"Bearer {token}"}).json()
        match = next(s for s in sessions if s["id"] == session_id)
        # Truncated to the configured max length, with a trailing ellipsis.
        assert match["title"].endswith("…")
        assert len(match["title"]) <= 49  # TITLE_MAX_LENGTH (48) + the ellipsis char


@patch("app.api.routes.chat.generate_tutor_reply", return_value="Sure!")
def test_list_sessions_only_returns_own_sessions(mock_reply):
    with TestClient(app) as client:
        token_a = _register_and_login(client, email="sessionsa@example.com")
        token_b = _register_and_login(client, email="sessionsb@example.com")

        client.post("/api/chat", json={"message": "Alice's question"}, headers={"Authorization": f"Bearer {token_a}"})

        sessions_b = client.get("/api/chat/sessions", headers={"Authorization": f"Bearer {token_b}"}).json()
        assert sessions_b == []  # Bob has no sessions, and definitely can't see Alice's

        sessions_a = client.get("/api/chat/sessions", headers={"Authorization": f"Bearer {token_a}"}).json()
        assert len(sessions_a) == 1


@patch("app.api.routes.chat.generate_tutor_reply", return_value="Sure!")
def test_delete_session_removes_it_and_its_messages(mock_reply):
    with TestClient(app) as client:
        token = _register_and_login(client, email="deletetest@example.com")
        resp = client.post("/api/chat", json={"message": "temporary"}, headers={"Authorization": f"Bearer {token}"})
        session_id = resp.json()["session_id"]

        delete_resp = client.delete(f"/api/chat/sessions/{session_id}", headers={"Authorization": f"Bearer {token}"})
        assert delete_resp.status_code == 204

        history_resp = client.get(f"/api/chat/history/{session_id}", headers={"Authorization": f"Bearer {token}"})
        assert history_resp.status_code == 404

        sessions = client.get("/api/chat/sessions", headers={"Authorization": f"Bearer {token}"}).json()
        assert session_id not in [s["id"] for s in sessions]


@patch("app.api.routes.chat.generate_tutor_reply", return_value="Sure!")
def test_set_and_clear_message_feedback(mock_reply):
    with TestClient(app) as client:
        token = _register_and_login(client, email="feedbacktest@example.com")
        resp = client.post("/api/chat", json={"message": "hello"}, headers={"Authorization": f"Bearer {token}"})
        message_id = resp.json()["message_id"]

        up = client.patch(
            f"/api/chat/messages/{message_id}/feedback",
            json={"feedback": "up"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert up.status_code == 200
        assert up.json() == {"id": message_id, "feedback": "up"}

        cleared = client.patch(
            f"/api/chat/messages/{message_id}/feedback",
            json={"feedback": None},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert cleared.json()["feedback"] is None


@patch("app.api.routes.chat.generate_tutor_reply", return_value="Sure!")
def test_cannot_set_feedback_on_another_users_message(mock_reply):
    with TestClient(app) as client:
        token_a = _register_and_login(client, email="feedbackowner@example.com")
        token_b = _register_and_login(client, email="feedbackintruder@example.com")

        resp = client.post("/api/chat", json={"message": "private"}, headers={"Authorization": f"Bearer {token_a}"})
        message_id = resp.json()["message_id"]

        blocked = client.patch(
            f"/api/chat/messages/{message_id}/feedback",
            json={"feedback": "down"},
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert blocked.status_code == 404
    with TestClient(app) as client:
        token_a = _register_and_login(client, email="deleteowner@example.com")
        token_b = _register_and_login(client, email="deleteintruder@example.com")

        with patch("app.api.routes.chat.generate_tutor_reply", return_value="Sure!"):
            resp = client.post("/api/chat", json={"message": "private"}, headers={"Authorization": f"Bearer {token_a}"})
        session_id = resp.json()["session_id"]

        delete_resp = client.delete(f"/api/chat/sessions/{session_id}", headers={"Authorization": f"Bearer {token_b}"})
        assert delete_resp.status_code == 404

        # Confirm it's still there for the real owner.
        history_resp = client.get(f"/api/chat/history/{session_id}", headers={"Authorization": f"Bearer {token_a}"})
        assert history_resp.status_code == 200


def _mock_stream(message, history=None):
    for word in ["Two", " plus", " two", " is", " four."]:
        yield word


@patch("app.api.routes.chat.stream_tutor_reply", side_effect=_mock_stream)
def test_stream_message_emits_sse_frames(mock_stream):
    with TestClient(app) as client:
        token = _register_and_login(client, email="streamer@example.com")

        with client.stream(
            "POST",
            "/api/chat/stream",
            json={"message": "What is 2+2?"},
            headers={"Authorization": f"Bearer {token}"},
        ) as resp:
            assert resp.status_code == 200
            assert resp.headers["content-type"].startswith("text/event-stream")
            raw = "".join(resp.iter_text())

        # A session frame should arrive first, chunk frames carry the text,
        # and a done frame should close things out.
        assert "event: session" in raw
        assert "event: chunk" in raw
        assert "event: done" in raw
        assert "Two" in raw and "four." in raw
