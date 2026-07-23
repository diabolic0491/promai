from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    hash_password,
)
from app.models.user import User, UserRole


PASSWORD = "Strong-test-password-123"


def add_user(
    session: Session,
    *,
    username: str,
    role: UserRole,
    is_active: bool = True,
) -> User:
    user = User(
        username=username,
        full_name=f"Пользователь {username}",
        password_hash=hash_password(PASSWORD),
        role=role.value,
        is_active=is_active,
    )
    session.add(user)
    session.flush()
    return user


def test_health_is_public_but_business_api_is_not(
    anonymous_client: TestClient,
) -> None:
    health_response = anonymous_client.get("/health")
    protected_response = anonymous_client.get("/contracts")

    assert health_response.status_code == 200
    assert protected_response.status_code == 401
    assert protected_response.headers["www-authenticate"] == "Bearer"


def test_login_me_refresh_rotation_and_logout(
    anonymous_client: TestClient,
    db_session: Session,
) -> None:
    user = add_user(
        db_session,
        username="auth-admin",
        role=UserRole.ADMIN,
    )

    login_response = anonymous_client.post(
        "/auth/login",
        json={
            "username": "AUTH-ADMIN",
            "password": PASSWORD,
        },
    )

    assert login_response.status_code == 200
    first_pair = login_response.json()
    assert first_pair["token_type"] == "bearer"

    me_response = anonymous_client.get(
        "/auth/me",
        headers={
            "Authorization": (f"Bearer {first_pair['access_token']}"),
        },
    )

    assert me_response.status_code == 200
    assert me_response.json()["id"] == user.id
    assert me_response.json()["role"] == "admin"

    refresh_response = anonymous_client.post(
        "/auth/refresh",
        json={
            "refresh_token": (first_pair["refresh_token"]),
        },
    )

    assert refresh_response.status_code == 200
    second_pair = refresh_response.json()
    assert second_pair["refresh_token"] != first_pair["refresh_token"]

    replay_response = anonymous_client.post(
        "/auth/refresh",
        json={
            "refresh_token": (first_pair["refresh_token"]),
        },
    )

    assert replay_response.status_code == 401

    logout_response = anonymous_client.post(
        "/auth/logout",
        json={
            "refresh_token": (second_pair["refresh_token"]),
        },
        headers={
            "Authorization": (f"Bearer {second_pair['access_token']}"),
        },
    )

    assert logout_response.status_code == 204

    after_logout_response = anonymous_client.post(
        "/auth/refresh",
        json={
            "refresh_token": (second_pair["refresh_token"]),
        },
    )

    assert after_logout_response.status_code == 401


def test_manager_can_work_but_cannot_administer(
    manager_client: TestClient,
) -> None:
    counterparty_response = manager_client.post(
        "/counterparties",
        json={
            "unp": "900000777",
            "name": "Тестовый контрагент",
        },
    )
    users_response = manager_client.get("/users")
    organization_response = manager_client.patch(
        "/organization-profile",
        json={"short_name": "Недоступное изменение"},
    )
    templates_response = manager_client.get("/document-templates")
    template_create_response = manager_client.post(
        "/document-templates",
        data={
            "name": "Недоступный шаблон",
            "template_type": "contract",
            "required_variables": "[]",
        },
        files={
            "file": (
                "template.docx",
                b"not-a-docx",
                (
                    "application/vnd.openxmlformats-"
                    "officedocument.wordprocessingml."
                    "document"
                ),
            ),
        },
    )

    assert counterparty_response.status_code == 201
    assert users_response.status_code == 403
    assert organization_response.status_code == 403
    assert templates_response.status_code == 200
    assert template_create_response.status_code == 403


def test_admin_manages_only_admin_and_manager_roles(
    client: TestClient,
) -> None:
    manager_response = client.post(
        "/users",
        json={
            "username": "new-manager",
            "full_name": "Новый менеджер",
            "password": PASSWORD,
            "role": "manager",
        },
    )
    observer_response = client.post(
        "/users",
        json={
            "username": "observer",
            "password": PASSWORD,
            "role": "observer",
        },
    )

    assert manager_response.status_code == 201
    assert manager_response.json()["role"] == "manager"
    assert observer_response.status_code == 422


def test_disabled_user_is_rejected_immediately(
    anonymous_client: TestClient,
    db_session: Session,
) -> None:
    user = add_user(
        db_session,
        username="disabled-manager",
        role=UserRole.MANAGER,
        is_active=False,
    )
    token = create_access_token(
        user_id=user.id,
        role=user.role,
    )

    response = anonymous_client.get(
        "/counterparties",
        headers={
            "Authorization": (f"Bearer {token.value}"),
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == ("Пользователь отключён")


def test_contract_audit_records_actor(
    client: TestClient,
    db_session: Session,
) -> None:
    admin = db_session.scalar(select(User).where(User.username == "test-admin"))
    assert admin is not None

    counterparty_response = client.post(
        "/counterparties",
        json={
            "unp": "900000778",
            "name": "Контрагент для аудита",
        },
    )
    assert counterparty_response.status_code == 201

    contract_response = client.post(
        "/contracts",
        json={
            "counterparty_id": (counterparty_response.json()["id"]),
            "number": "RBAC-AUDIT-1",
            "title": "Договор с автором",
            "contract_date": "2026-07-23",
        },
    )
    assert contract_response.status_code == 201

    contract_id = contract_response.json()["id"]
    events_response = client.get(f"/contracts/{contract_id}/events")
    history_response = client.get(f"/contracts/{contract_id}/status-history")

    assert events_response.status_code == 200
    assert history_response.status_code == 200
    assert events_response.json()[0]["actor_user_id"] == admin.id
    assert history_response.json()[0]["changed_by_user_id"] == admin.id
