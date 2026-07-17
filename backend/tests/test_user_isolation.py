"""
Regression tests for cross-user data isolation.

These exist because a frontend bug once caused a previous user's name and
chat history to appear after switching accounts on the same device. The
backend itself was already correctly scoping every query by the
authenticated user's ID -- these tests pin that down permanently so it
can't regress silently in either direction.
"""

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


def _register_and_login(client, email, full_name):
    client.post("/api/auth/register", json={"email": email, "password": "pass12345", "full_name": full_name})
    resp = client.post("/api/auth/login", json={"email": email, "password": "pass12345"})
    return resp.json()["token"]


def test_users_me_returns_correct_identity_per_token():
    with TestClient(app) as client:
        token_a = _register_and_login(client, "isoalice@test.com", "Iso Alice")
        token_b = _register_and_login(client, "isobob@test.com", "Iso Bob")

        me_a = client.get("/api/users/me", headers={"Authorization": f"Bearer {token_a}"}).json()
        me_b = client.get("/api/users/me", headers={"Authorization": f"Bearer {token_b}"}).json()

        assert me_a["email"] == "isoalice@test.com"
        assert me_a["full_name"] == "Iso Alice"
        assert me_b["email"] == "isobob@test.com"
        assert me_b["full_name"] == "Iso Bob"


def test_user_cannot_read_another_users_chat_history():
    with TestClient(app) as client:
        token_a = _register_and_login(client, "isoalice2@test.com", "Iso Alice Two")
        token_b = _register_and_login(client, "isobob2@test.com", "Iso Bob Two")

        with patch("app.api.routes.chat.generate_tutor_reply", return_value="private reply"):
            resp = client.post(
                "/api/chat",
                json={"message": "a private message"},
                headers={"Authorization": f"Bearer {token_a}"},
            )
        session_id = resp.json()["session_id"]

        # The other user must not be able to read it.
        blocked = client.get(f"/api/chat/history/{session_id}", headers={"Authorization": f"Bearer {token_b}"})
        assert blocked.status_code == 404

        # The owner still can.
        allowed = client.get(f"/api/chat/history/{session_id}", headers={"Authorization": f"Bearer {token_a}"})
        assert allowed.status_code == 200
        assert allowed.json()["messages"][0]["content"] == "a private message"
