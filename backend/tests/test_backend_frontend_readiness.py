from io import BytesIO
from pathlib import Path

import pytest
from docx import Document
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.document_template import (
    DocumentTemplate,
)
from app.services import (
    contract_documents,
    document_templates,
    technical_specifications,
)

DOCX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument."
    "wordprocessingml.document"
)


@pytest.fixture(autouse=True)
def storage_root(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> Path:
    for service in (
        contract_documents,
        document_templates,
        technical_specifications,
    ):
        monkeypatch.setattr(
            service.settings,
            "storage_root",
            str(tmp_path),
        )

    return tmp_path


def build_docx_template(text: str) -> bytes:
    stream = BytesIO()
    document = Document()
    document.add_paragraph(text)
    document.save(stream)
    return stream.getvalue()


def create_counterparty(
    client: TestClient,
    *,
    unp: str,
    name: str,
) -> dict[str, object]:
    response = client.post(
        "/counterparties",
        json={
            "unp": unp,
            "name": name,
            "short_name": name,
            "legal_address": "г. Минск",
        },
    )
    assert response.status_code == 201
    return response.json()


def upload_template(
    client: TestClient,
    *,
    name: str,
    template_type: str,
    content: bytes,
) -> dict[str, object]:
    response = client.post(
        "/document-templates",
        data={
            "name": name,
            "template_type": template_type,
            "required_variables": "[]",
        },
        files={
            "file": (
                f"{name}.docx",
                content,
                DOCX_MEDIA_TYPE,
            ),
        },
    )
    assert response.status_code == 201
    return response.json()


def test_counterparty_and_contract_lists_are_frontend_ready(
    client: TestClient,
) -> None:
    selected = create_counterparty(
        client,
        unp="920000001",
        name="ООО Альфа Поиск",
    )
    create_counterparty(
        client,
        unp="920000002",
        name="ООО Бета",
    )
    contract_response = client.post(
        "/contracts",
        json={
            "counterparty_id": selected["id"],
            "number": "SEARCH-READY-001",
            "title": "Договор для нового интерфейса",
            "contract_date": "2026-07-28",
        },
    )
    assert contract_response.status_code == 201
    contract = contract_response.json()
    assert contract["counterparty_name"] == (
        "ООО Альфа Поиск"
    )
    assert contract["template_name"] is None
    assert "generated_storage_path" not in contract

    counterparties_response = client.get(
        "/counterparties",
        params={
            "search": "Альфа",
            "limit": 1,
            "offset": 0,
        },
    )
    assert counterparties_response.status_code == 200
    counterparties_page = (
        counterparties_response.json()
    )
    assert counterparties_page == {
        "items": [selected],
        "total": 1,
        "limit": 1,
        "offset": 0,
    }

    contracts_response = client.get(
        "/contracts",
        params={
            "search": "Альфа",
            "limit": 1,
            "offset": 0,
        },
    )
    assert contracts_response.status_code == 200
    contracts_page = contracts_response.json()
    assert contracts_page["total"] == 1
    assert contracts_page["limit"] == 1
    assert contracts_page["offset"] == 0
    assert contracts_page["items"][0]["id"] == (
        contract["id"]
    )
    assert contracts_page["items"][0][
        "counterparty_name"
    ] == "ООО Альфа Поиск"


def test_counterparty_full_lifecycle(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(
        client,
        unp="920000004",
        name="ООО Жизненный цикл",
    )
    update_response = client.patch(
        f"/counterparties/{counterparty['id']}",
        json={
            "short_name": "ООО Цикл",
            "legal_address": "г. Гродно",
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["short_name"] == (
        "ООО Цикл"
    )

    archive_response = client.post(
        (
            f"/counterparties/{counterparty['id']}"
            "/archive"
        )
    )
    assert archive_response.status_code == 200
    assert archive_response.json()["status"] == (
        "archived"
    )
    hidden_response = client.get(
        "/counterparties",
        params={"search": "920000004"},
    )
    assert hidden_response.status_code == 200
    assert hidden_response.json()["total"] == 0
    archived_list_response = client.get(
        "/counterparties",
        params={
            "search": "920000004",
            "include_archived": True,
        },
    )
    assert archived_list_response.status_code == 200
    assert archived_list_response.json()["total"] == 1

    restore_response = client.post(
        (
            f"/counterparties/{counterparty['id']}"
            "/restore"
        )
    )
    assert restore_response.status_code == 200
    assert restore_response.json()["status"] == "active"


def test_manager_sees_and_downloads_only_active_templates(
    client: TestClient,
    manager_client: TestClient,
) -> None:
    active_content = build_docx_template(
        "Договор: {{contract.title}}"
    )
    active = upload_template(
        client,
        name="MVP-RBAC активный",
        template_type="contract",
        content=active_content,
    )
    inactive = upload_template(
        client,
        name="MVP-RBAC выключенный",
        template_type="contract",
        content=build_docx_template("Выключен"),
    )
    archived = upload_template(
        client,
        name="MVP-RBAC архивный",
        template_type="contract",
        content=build_docx_template("Архив"),
    )
    disable_response = client.patch(
        f"/document-templates/{inactive['id']}",
        json={"is_active": False},
    )
    assert disable_response.status_code == 200
    archive_response = client.post(
        f"/document-templates/{archived['id']}/archive"
    )
    assert archive_response.status_code == 200

    manager_list_response = manager_client.get(
        "/document-templates",
        params={
            "include_archived": True,
            "search": "MVP-RBAC",
        },
    )
    assert manager_list_response.status_code == 200
    manager_page = manager_list_response.json()
    manager_ids = {
        item["id"]
        for item in manager_page["items"]
    }
    assert active["id"] in manager_ids
    assert inactive["id"] not in manager_ids
    assert archived["id"] not in manager_ids
    assert manager_page["total"] == len(
        manager_page["items"]
    )

    active_download = manager_client.get(
        (
            f"/document-templates/{active['id']}"
            "/download"
        )
    )
    assert active_download.status_code == 200
    assert active_download.content == active_content

    for template_id in (
        inactive["id"],
        archived["id"],
    ):
        get_response = manager_client.get(
            f"/document-templates/{template_id}"
        )
        download_response = manager_client.get(
            (
                f"/document-templates/{template_id}"
                "/download"
            )
        )
        assert get_response.status_code == 404
        assert download_response.status_code == 404

    admin_archived_list = client.get(
        "/document-templates",
        params={
            "include_archived": True,
            "search": "MVP-RBAC архивный",
        },
    )
    assert admin_archived_list.status_code == 200
    assert admin_archived_list.json()["total"] == 1
    restore_response = client.post(
        (
            f"/document-templates/{archived['id']}"
            "/restore"
        )
    )
    assert restore_response.status_code == 200
    restored_manager_response = manager_client.get(
        f"/document-templates/{archived['id']}"
    )
    assert restored_manager_response.status_code == 200


def test_template_download_rejects_path_outside_storage(
    client: TestClient,
    db_session: Session,
    storage_root: Path,
) -> None:
    template = upload_template(
        client,
        name="MVP небезопасный путь",
        template_type="contract",
        content=build_docx_template("Шаблон"),
    )
    outside_path = storage_root / "outside.docx"
    outside_path.write_bytes(
        build_docx_template("Вне каталога")
    )
    stored_template = db_session.get(
        DocumentTemplate,
        template["id"],
    )
    assert stored_template is not None
    stored_template.storage_path = str(outside_path)
    db_session.commit()

    response = client.get(
        (
            f"/document-templates/{template['id']}"
            "/download"
        )
    )

    assert response.status_code == 404
    assert response.json() == {
        "detail": "Файл шаблона не найден"
    }


def test_technical_specification_lifecycle_and_search(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(
        client,
        unp="920000003",
        name="ООО Заказчик ТЗ",
    )
    template = upload_template(
        client,
        name="Шаблон ТЗ frontend",
        template_type="technical_specification",
        content=build_docx_template(
            "Техническое задание: {{tz.title}}"
        ),
    )
    create_response = client.post(
        "/technical-specifications",
        json={
            "counterparty_id": counterparty["id"],
            "template_id": template["id"],
            "title": "ТЗ на внедрение PromAI",
            "procurement_subject": (
                "Разработка frontend CRM"
            ),
            "legal_basis": "Законодательство РБ",
            "internal_regulation_document": (
                "Положение о закупках"
            ),
            "approval_date": "2026-07-28",
        },
    )
    assert create_response.status_code == 201
    technical_specification = (
        create_response.json()
    )
    assert technical_specification[
        "counterparty_name"
    ] == "ООО Заказчик ТЗ"
    assert technical_specification[
        "template_name"
    ] == "Шаблон ТЗ frontend"
    assert technical_specification[
        "contract_number"
    ] is None
    assert "generated_storage_path" not in (
        technical_specification
    )

    list_response = client.get(
        "/technical-specifications",
        params={"search": "frontend CRM"},
    )
    assert list_response.status_code == 200
    page = list_response.json()
    assert page["total"] == 1
    assert page["items"][0]["id"] == (
        technical_specification["id"]
    )
    update_response = client.patch(
        (
            "/technical-specifications/"
            f"{technical_specification['id']}"
        ),
        json={"title": "Обновлённое ТЗ PromAI"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["title"] == (
        "Обновлённое ТЗ PromAI"
    )

    generate_response = client.post(
        (
            "/technical-specifications/"
            f"{technical_specification['id']}"
            "/generate"
        )
    )
    assert generate_response.status_code == 200
    assert generate_response.content
    detail_response = client.get(
        (
            "/technical-specifications/"
            f"{technical_specification['id']}"
        )
    )
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["generated_file_name"] is not None
    assert "generated_storage_path" not in detail

    archive_response = client.post(
        (
            "/technical-specifications/"
            f"{technical_specification['id']}"
            "/archive"
        )
    )
    assert archive_response.status_code == 200
    assert archive_response.json()["is_archived"] is True
    restore_response = client.post(
        (
            "/technical-specifications/"
            f"{technical_specification['id']}"
            "/restore"
        )
    )
    assert restore_response.status_code == 200
    assert restore_response.json()["is_archived"] is False


def test_user_pagination_and_organization_profile_update(
    client: TestClient,
) -> None:
    create_user_response = client.post(
        "/users",
        json={
            "username": "frontend-manager",
            "full_name": "Менеджер Frontend",
            "password": "Strong-test-password-123",
            "role": "manager",
        },
    )
    assert create_user_response.status_code == 201

    users_response = client.get(
        "/users",
        params={
            "search": "frontend-manager",
            "limit": 1,
        },
    )
    assert users_response.status_code == 200
    users_page = users_response.json()
    assert users_page["total"] == 1
    assert users_page["limit"] == 1
    assert users_page["items"][0]["username"] == (
        "frontend-manager"
    )

    update_profile_response = client.patch(
        "/organization-profile",
        json={
            "short_name": "ООО «PromAI MVP»",
            "phone": "+375 29 000-00-00",
        },
    )
    assert update_profile_response.status_code == 200
    updated_profile = update_profile_response.json()
    assert updated_profile["short_name"] == (
        "ООО «PromAI MVP»"
    )
    assert updated_profile["phone"] == (
        "+375 29 000-00-00"
    )
