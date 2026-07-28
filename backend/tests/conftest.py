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
os.environ["CONTRACT_ANALYSIS_ENABLED"] = "false"

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
from app.services import (  # noqa: E402
    contract_analysis_jobs,
    contract_analysis_runs,
)


TEST_PASSWORD = "Valid-test-password-123"
TEST_PASSWORD_HASH = hash_password(TEST_PASSWORD)


def override_analysis_job_runner(
    *,
    monkeypatch: pytest.MonkeyPatch,
    session: Session,
) -> None:
    def execute_job(
        *,
        analysis_id: int,
        execution_context,
    ) -> None:
        try:
            (
                contract_analysis_runs
                .execute_contract_analysis(
                    session=session,
                    analysis_id=analysis_id,
                    execution_context=execution_context,
                )
            )
        except (
            contract_analysis_runs
            .ContractAnalysisExecutionFailedError
        ):
            return

    monkeypatch.setattr(
        contract_analysis_jobs,
        "execute_contract_analysis_job",
        execute_job,
    )


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
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[TestClient, None, None]:
    override_analysis_job_runner(
        monkeypatch=monkeypatch,
        session=db_session,
    )
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
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[TestClient, None, None]:
    override_analysis_job_runner(
        monkeypatch=monkeypatch,
        session=db_session,
    )
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
