import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import (
    Session,
    sessionmaker,
)


os.environ["AUTH_SECRET_KEY"] = (
    "test-only-secret-key-at-least-32-characters"
)

from app.core.security import (  # noqa: E402
    create_access_token,
    hash_password,
)
from app.db.session import (
    engine,
    get_db_session,
)  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402


TEST_PASSWORD = "Valid-test-password-123"
TEST_PASSWORD_HASH = hash_password(TEST_PASSWORD)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    connection = engine.connect()
    transaction = connection.begin()

    TestingSessionLocal = sessionmaker(
        bind=connection,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )

    session = TestingSessionLocal()

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(
    db_session: Session,
) -> Generator[TestClient, None, None]:
    admin = User(
        username="test-admin",
        full_name="Тестовый администратор",
        password_hash=TEST_PASSWORD_HASH,
        role=UserRole.ADMIN.value,
        is_active=True,
    )
    db_session.add(admin)
    db_session.flush()

    token = create_access_token(
        user_id=admin.id,
        role=admin.role,
    )

    def override_get_db_session():
        yield db_session

    app.dependency_overrides[
        get_db_session
    ] = override_get_db_session

    with TestClient(
        app,
        headers={
            "Authorization": (
                f"Bearer {token.value}"
            ),
        },
    ) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def manager_client(
    db_session: Session,
) -> Generator[TestClient, None, None]:
    manager = User(
        username="test-manager",
        full_name="Тестовый менеджер",
        password_hash=TEST_PASSWORD_HASH,
        role=UserRole.MANAGER.value,
        is_active=True,
    )
    db_session.add(manager)
    db_session.flush()

    token = create_access_token(
        user_id=manager.id,
        role=manager.role,
    )

    def override_get_db_session():
        yield db_session

    app.dependency_overrides[
        get_db_session
    ] = override_get_db_session

    with TestClient(
        app,
        headers={
            "Authorization": (
                f"Bearer {token.value}"
            ),
        },
    ) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def anonymous_client(
    db_session: Session,
) -> Generator[TestClient, None, None]:
    def override_get_db_session():
        yield db_session

    app.dependency_overrides[
        get_db_session
    ] = override_get_db_session

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
