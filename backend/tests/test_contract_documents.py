import json
from io import BytesIO
from pathlib import Path
from typing import Any

import pytest
from docx import Document
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.contract import Contract
from app.services import (
    contract_documents,
    document_templates,
)
from app.services.technical_specification_docx import (
    get_template_variables,
    iter_document_paragraphs,
)


DOCX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument."
    "wordprocessingml.document"
)


@pytest.fixture
def storage_root(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> Path:
    monkeypatch.setattr(
        contract_documents.settings,
        "storage_root",
        str(tmp_path),
    )
    monkeypatch.setattr(
        document_templates.settings,
        "storage_root",
        str(tmp_path),
    )
    return tmp_path


def create_counterparty(
    client: TestClient,
) -> dict[str, Any]:
    response = client.post(
        "/counterparties",
        json={
            "unp": "900000101",
            "name": "ООО «Покупатель»",
            "short_name": "ООО «Покупатель»",
            "legal_address": "г. Минск",
        },
    )

    assert response.status_code == 201
    return response.json()


def update_organization_profile(
    client: TestClient,
) -> dict[str, Any]:
    response = client.patch(
        "/organization-profile",
        json={
            "name": "ООО «Промас Инжиниринг»",
            "short_name": "ООО «Промас»",
            "unp": "590000001",
            "legal_address": "г. Гродно",
            "email": "info@example.by",
            "phone": "+375 00 000-00-00",
            "director_name": "Иванов И.И.",
            "director_position": "Директор",
            "bank_name": "ОАО «Тест Банк»",
            "bank_account": "BY00TEST00000000000000000000",
            "bank_code": "TESTBY2X",
        },
    )

    assert response.status_code == 200
    return response.json()


def create_template_file(
    path: Path,
    *,
    missing_variables_only: bool = False,
) -> None:
    document = Document()

    if missing_variables_only:
        document.add_paragraph(
            "{{contract.number}} "
            "{{contract.subject}} "
            "{{counterparty.account}}"
        )
    else:
        paragraph = document.add_paragraph(
            "Договор № "
        )
        first_run = paragraph.add_run("{{contract.")
        first_run.bold = True
        paragraph.add_run("number}} от ")
        paragraph.add_run(
            "{{contract.day}} "
            "{{contract.month}} "
            "{{contract.year}}"
        )

        document.add_paragraph(
            "Предмет: {{contract.subject}}; "
            "сумма: {{contract.amount}} {{contract.currency}}"
        )
        document.add_paragraph(
            "Поставщик: {{organization.name}}, "
            "{{organization.address}}, "
            "{{organization.account}}, "
            "{{organization.authority}}"
        )

        table = document.add_table(rows=1, cols=1)
        table.cell(0, 0).text = (
            "Покупатель: {{counterparty.name}}, "
            "{{counterparty.address}}, "
            "{{counterparty.account}}, "
            "{{counterparty.director_name}}"
        )

    document.save(path)


def upload_template(
    client: TestClient,
    template_path: Path,
    *,
    template_type: str = "contract",
    required_variables: list[str] | None = None,
) -> dict[str, Any]:
    with template_path.open("rb") as template_file:
        response = client.post(
            "/document-templates",
            data={
                "name": "Шаблон договора",
                "template_type": template_type,
                "required_variables": json.dumps(
                    required_variables or [],
                    ensure_ascii=False,
                ),
            },
            files={
                "file": (
                    "contract-template.docx",
                    template_file,
                    DOCX_MEDIA_TYPE,
                ),
            },
        )

    assert response.status_code == 201
    return response.json()


def contract_form_data() -> dict[str, Any]:
    return {
        "contract": {
            "city": "Гродно",
            "subject": "Поставка оборудования",
            "delivery_scope": "Поставка и монтаж",
            "amount_words": "Одна тысяча рублей",
            "vat_amount": "166.67",
            "vat_amount_words": (
                "Сто шестьдесят шесть рублей 67 копеек"
            ),
            "payment_terms": "Оплата в течение 10 дней",
            "delivery_period": "30 календарных дней",
            "delivery_address": "г. Минск",
            "number": "НЕ ДОЛЖНО ПОПАСТЬ В ДОКУМЕНТ",
        },
        "organization": {
            "authority": "Устава",
            "name": "НЕ ДОЛЖНО ПОПАСТЬ В ДОКУМЕНТ",
        },
        "counterparty": {
            "account": "BY11TEST11111111111111111111",
            "bank": "ЗАО «Банк Покупателя»",
            "bic": "BUYERBY2X",
            "director_name": "Петров П.П.",
            "director_position": "Директор",
            "authority": "Устава",
            "name": "НЕ ДОЛЖНО ПОПАСТЬ В ДОКУМЕНТ",
        },
    }


def create_contract(
    client: TestClient,
    counterparty_id: int,
    *,
    template_id: int | None,
    form_data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "counterparty_id": counterparty_id,
        "template_id": template_id,
        "number": "Д-101/26",
        "title": "Договор поставки",
        "contract_date": "2026-07-22",
        "start_date": "2026-07-22",
        "end_date": "2026-12-31",
        "amount": "1000.00",
        "currency": "BYN",
        "notes": "Тестовая генерация",
        "owner_role": "supplier",
        "counterparty_role": "buyer",
        "form_data": form_data or {},
    }
    response = client.post(
        "/contracts",
        json=payload,
    )

    assert response.status_code == 201
    return response.json()


def document_text(content: bytes) -> str:
    document = Document(BytesIO(content))
    return "\n".join(
        paragraph.text
        for paragraph in iter_document_paragraphs(
            document
        )
    )


def test_contract_template_can_be_uploaded(
    client: TestClient,
    storage_root: Path,
) -> None:
    template_path = storage_root / "source.docx"
    create_template_file(template_path)

    template = upload_template(
        client,
        template_path,
    )

    assert template["template_type"] == "contract"
    assert template["file_name"] == (
        "contract-template.docx"
    )


def test_generate_and_download_contract_docx(
    client: TestClient,
    storage_root: Path,
) -> None:
    counterparty = create_counterparty(client)
    update_organization_profile(client)
    template_path = storage_root / "source.docx"
    create_template_file(template_path)
    template = upload_template(
        client,
        template_path,
    )
    contract = create_contract(
        client,
        counterparty["id"],
        template_id=template["id"],
        form_data=contract_form_data(),
    )

    response = client.post(
        f"/contracts/{contract['id']}/generate"
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        DOCX_MEDIA_TYPE
    )

    text = document_text(response.content)
    generated_document = Document(
        BytesIO(response.content)
    )

    assert "Д-101/26" in text
    assert "22 июля 2026" in text
    assert "Поставка оборудования" in text
    assert "1000.00 BYN" in text
    assert "ООО «Промас Инжиниринг»" in text
    assert "BY00TEST00000000000000000000" in text
    assert "ООО «Покупатель»" in text
    assert "BY11TEST11111111111111111111" in text
    assert "Петров П.П." in text
    assert "НЕ ДОЛЖНО ПОПАСТЬ" not in text
    assert get_template_variables(
        generated_document
    ) == set()

    contract_response = client.get(
        f"/contracts/{contract['id']}"
    )
    assert contract_response.status_code == 200
    generated_contract = contract_response.json()
    assert generated_contract["generated_file_name"] == (
        "Договор № Д-101_26.docx"
    )
    assert generated_contract[
        "generated_storage_path"
    ] is not None

    download_response = client.get(
        f"/contracts/{contract['id']}/download"
    )
    assert download_response.status_code == 200
    assert download_response.content == response.content

    events_response = client.get(
        f"/contracts/{contract['id']}/events"
    )
    assert events_response.status_code == 200
    events = events_response.json()
    assert events[0]["event_type"] == "generated"
    assert events[0]["event_data"]["template_id"] == (
        template["id"]
    )
    assert events[0]["event_data"][
        "replaced_previous_file"
    ] is False


def test_generate_reports_all_missing_variables(
    client: TestClient,
    storage_root: Path,
) -> None:
    counterparty = create_counterparty(client)
    template_path = storage_root / "missing.docx"
    create_template_file(
        template_path,
        missing_variables_only=True,
    )
    template = upload_template(
        client,
        template_path,
        required_variables=[
            "organization.authority",
        ],
    )
    contract = create_contract(
        client,
        counterparty["id"],
        template_id=template["id"],
    )

    response = client.post(
        f"/contracts/{contract['id']}/generate"
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": {
            "message": (
                "Не заполнены обязательные "
                "переменные шаблона"
            ),
            "missing_variables": [
                "contract.subject",
                "counterparty.account",
                "organization.authority",
            ],
        },
    }

    contract_response = client.get(
        f"/contracts/{contract['id']}"
    )
    assert contract_response.json()[
        "generated_storage_path"
    ] is None


def test_contract_rejects_wrong_template_type(
    client: TestClient,
    storage_root: Path,
) -> None:
    counterparty = create_counterparty(client)
    template_path = storage_root / "tz.docx"
    create_template_file(template_path)
    template = upload_template(
        client,
        template_path,
        template_type="technical_specification",
    )

    response = client.post(
        "/contracts",
        json={
            "counterparty_id": counterparty["id"],
            "template_id": template["id"],
            "number": "WRONG-TEMPLATE",
            "title": "Договор",
            "contract_date": "2026-07-22",
        },
    )

    assert response.status_code == 409
    assert response.json() == {
        "detail": (
            "Выбранный шаблон не предназначен "
            "для договоров"
        ),
    }


def test_contract_without_template_cannot_be_generated(
    client: TestClient,
    storage_root: Path,
) -> None:
    counterparty = create_counterparty(client)
    contract = create_contract(
        client,
        counterparty["id"],
        template_id=None,
    )

    response = client.post(
        f"/contracts/{contract['id']}/generate"
    )

    assert response.status_code == 409
    assert response.json() == {
        "detail": "Для договора не выбран шаблон",
    }


def test_archived_contract_cannot_be_generated(
    client: TestClient,
    storage_root: Path,
) -> None:
    counterparty = create_counterparty(client)
    template_path = storage_root / "source.docx"
    create_template_file(template_path)
    template = upload_template(
        client,
        template_path,
    )
    contract = create_contract(
        client,
        counterparty["id"],
        template_id=template["id"],
        form_data=contract_form_data(),
    )
    archive_response = client.post(
        f"/contracts/{contract['id']}/archive"
    )
    assert archive_response.status_code == 200

    response = client.post(
        f"/contracts/{contract['id']}/generate"
    )

    assert response.status_code == 409


def test_repeated_generation_replaces_previous_file(
    client: TestClient,
    db_session: Session,
    storage_root: Path,
) -> None:
    counterparty = create_counterparty(client)
    update_organization_profile(client)
    template_path = storage_root / "source.docx"
    create_template_file(template_path)
    template = upload_template(
        client,
        template_path,
    )
    contract_data = create_contract(
        client,
        counterparty["id"],
        template_id=template["id"],
        form_data=contract_form_data(),
    )

    first_response = client.post(
        f"/contracts/{contract_data['id']}/generate"
    )
    assert first_response.status_code == 200

    db_session.expire_all()
    contract = db_session.get(
        Contract,
        contract_data["id"],
    )
    assert contract is not None
    first_path = Path(
        contract.generated_storage_path or ""
    )
    assert first_path.is_file()

    second_response = client.post(
        f"/contracts/{contract_data['id']}/generate"
    )
    assert second_response.status_code == 200

    db_session.expire_all()
    contract = db_session.get(
        Contract,
        contract_data["id"],
    )
    assert contract is not None
    second_path = Path(
        contract.generated_storage_path or ""
    )

    assert second_path.is_file()
    assert second_path != first_path
    assert not first_path.exists()

    events_response = client.get(
        f"/contracts/{contract_data['id']}/events"
    )
    generated_events = [
        event
        for event in events_response.json()
        if event["event_type"] == "generated"
    ]
    assert len(generated_events) == 2
    assert generated_events[0]["event_data"][
        "replaced_previous_file"
    ] is True


def test_contract_update_removes_generated_file(
    client: TestClient,
    db_session: Session,
    storage_root: Path,
) -> None:
    counterparty = create_counterparty(client)
    update_organization_profile(client)
    template_path = storage_root / "source.docx"
    create_template_file(template_path)
    template = upload_template(
        client,
        template_path,
    )
    contract_data = create_contract(
        client,
        counterparty["id"],
        template_id=template["id"],
        form_data=contract_form_data(),
    )
    generate_response = client.post(
        f"/contracts/{contract_data['id']}/generate"
    )
    assert generate_response.status_code == 200

    db_session.expire_all()
    contract = db_session.get(
        Contract,
        contract_data["id"],
    )
    assert contract is not None
    generated_path = Path(
        contract.generated_storage_path or ""
    )
    assert generated_path.is_file()

    update_response = client.patch(
        f"/contracts/{contract_data['id']}",
        json={
            "title": "Изменённый договор",
        },
    )

    assert update_response.status_code == 200
    assert update_response.json()[
        "generated_file_name"
    ] is None
    assert update_response.json()[
        "generated_storage_path"
    ] is None
    assert not generated_path.exists()

    download_response = client.get(
        f"/contracts/{contract_data['id']}/download"
    )
    assert download_response.status_code == 404


def test_download_rejects_path_outside_contract_storage(
    client: TestClient,
    db_session: Session,
    storage_root: Path,
) -> None:
    counterparty = create_counterparty(client)
    contract_data = create_contract(
        client,
        counterparty["id"],
        template_id=None,
    )
    outside_path = storage_root / "outside.docx"
    Document().save(outside_path)

    contract = db_session.get(
        Contract,
        contract_data["id"],
    )
    assert contract is not None
    contract.generated_file_name = "outside.docx"
    contract.generated_storage_path = str(outside_path)
    db_session.commit()

    response = client.get(
        f"/contracts/{contract_data['id']}/download"
    )

    assert response.status_code == 404
    assert response.json() == {
        "detail": (
            "Сгенерированный DOCX-файл не найден"
        ),
    }
