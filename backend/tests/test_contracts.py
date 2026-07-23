from typing import Any

from fastapi.testclient import TestClient


def create_counterparty(
    client: TestClient,
    *,
    unp: str = "900000001",
) -> dict[str, Any]:
    response = client.post(
        "/counterparties",
        json={
            "unp": unp,
            "name": f"Тестовый контрагент {unp}",
            "short_name": f"Контрагент {unp}",
            "legal_address": "г. Минск",
        },
    )

    assert response.status_code == 201

    return response.json()


def create_contract(
    client: TestClient,
    counterparty_id: int,
    *,
    number: str = "TEST-001",
) -> dict[str, Any]:
    response = client.post(
        "/contracts",
        json={
            "counterparty_id": counterparty_id,
            "number": number,
            "title": "Тестовый договор",
            "contract_date": "2026-07-21",
            "start_date": "2026-07-21",
            "end_date": "2026-12-31",
            "amount": "1000.00",
            "currency": "BYN",
            "notes": "Создан автоматическим тестом",
            "owner_role": "supplier",
            "counterparty_role": "buyer",
        },
    )

    assert response.status_code == 201

    return response.json()


def change_status(
    client: TestClient,
    contract_id: int,
    target_status: str,
):
    return client.patch(
        f"/contracts/{contract_id}/status",
        json={
            "status": target_status,
        },
    )


def test_create_contract_creates_initial_history(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(client)
    contract = create_contract(
        client,
        counterparty["id"],
    )

    assert contract["status"] == "draft"
    assert contract["archived_at"] is None
    assert contract["is_archived"] is False

    history_response = client.get(
        f"/contracts/{contract['id']}/status-history"
    )

    assert history_response.status_code == 200

    history = history_response.json()

    assert len(history) == 1
    assert history[0]["contract_id"] == contract["id"]
    assert history[0]["from_status"] is None
    assert history[0]["to_status"] == "draft"


def test_allowed_status_transition_is_saved_in_history(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(client)
    contract = create_contract(
        client,
        counterparty["id"],
    )

    response = change_status(
        client,
        contract["id"],
        "pending_approval",
    )

    assert response.status_code == 200
    assert response.json()["status"] == "pending_approval"

    history_response = client.get(
        f"/contracts/{contract['id']}/status-history"
    )

    assert history_response.status_code == 200

    history = history_response.json()

    assert len(history) == 2

    assert history[0]["from_status"] == "draft"
    assert history[0]["to_status"] == "pending_approval"

    assert history[1]["from_status"] is None
    assert history[1]["to_status"] == "draft"


def test_repeated_status_does_not_duplicate_history(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(client)
    contract = create_contract(
        client,
        counterparty["id"],
    )

    first_response = change_status(
        client,
        contract["id"],
        "pending_approval",
    )

    assert first_response.status_code == 200

    second_response = change_status(
        client,
        contract["id"],
        "pending_approval",
    )

    assert second_response.status_code == 200

    history_response = client.get(
        f"/contracts/{contract['id']}/status-history"
    )

    assert history_response.status_code == 200
    assert len(history_response.json()) == 2


def test_invalid_status_transition_returns_conflict(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(client)
    contract = create_contract(
        client,
        counterparty["id"],
    )

    response = change_status(
        client,
        contract["id"],
        "active",
    )

    assert response.status_code == 409

    history_response = client.get(
        f"/contracts/{contract['id']}/status-history"
    )

    assert history_response.status_code == 200
    assert len(history_response.json()) == 1


def test_unknown_status_returns_validation_error(
    client: TestClient,
) -> None:
    response = client.get(
        "/contracts",
        params={
            "status": "unknown-status",
        },
    )

    assert response.status_code == 422


def test_archive_preserves_lifecycle_status(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(client)
    contract = create_contract(
        client,
        counterparty["id"],
    )

    status_response = change_status(
        client,
        contract["id"],
        "pending_approval",
    )

    assert status_response.status_code == 200

    archive_response = client.post(
        f"/contracts/{contract['id']}/archive"
    )

    assert archive_response.status_code == 200

    archived_contract = archive_response.json()

    assert archived_contract["status"] == "pending_approval"
    assert archived_contract["archived_at"] is not None
    assert archived_contract["is_archived"] is True


def test_repeated_archive_returns_conflict(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(client)
    contract = create_contract(
        client,
        counterparty["id"],
    )

    first_response = client.post(
        f"/contracts/{contract['id']}/archive"
    )

    assert first_response.status_code == 200

    second_response = client.post(
        f"/contracts/{contract['id']}/archive"
    )

    assert second_response.status_code == 409
    assert second_response.json() == {
        "detail": "Договор уже находится в архиве",
    }


def test_archived_contract_cannot_be_edited(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(client)
    contract = create_contract(
        client,
        counterparty["id"],
    )

    archive_response = client.post(
        f"/contracts/{contract['id']}/archive"
    )

    assert archive_response.status_code == 200

    update_response = client.patch(
        f"/contracts/{contract['id']}",
        json={
            "title": "Изменённое название",
        },
    )

    assert update_response.status_code == 409


def test_archived_contract_status_cannot_be_changed(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(client)
    contract = create_contract(
        client,
        counterparty["id"],
    )

    archive_response = client.post(
        f"/contracts/{contract['id']}/archive"
    )

    assert archive_response.status_code == 200

    status_response = change_status(
        client,
        contract["id"],
        "pending_approval",
    )

    assert status_response.status_code == 409


def test_restore_preserves_lifecycle_status(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(client)
    contract = create_contract(
        client,
        counterparty["id"],
    )

    status_response = change_status(
        client,
        contract["id"],
        "pending_approval",
    )

    assert status_response.status_code == 200

    archive_response = client.post(
        f"/contracts/{contract['id']}/archive"
    )

    assert archive_response.status_code == 200

    restore_response = client.post(
        f"/contracts/{contract['id']}/restore"
    )

    assert restore_response.status_code == 200

    restored_contract = restore_response.json()

    assert restored_contract["status"] == "pending_approval"
    assert restored_contract["archived_at"] is None
    assert restored_contract["is_archived"] is False


def test_archived_contract_hidden_from_default_list(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(client)
    contract = create_contract(
        client,
        counterparty["id"],
    )

    archive_response = client.post(
        f"/contracts/{contract['id']}/archive"
    )

    assert archive_response.status_code == 200

    default_response = client.get("/contracts")

    assert default_response.status_code == 200

    default_ids = {
        item["id"]
        for item in default_response.json()
    }

    assert contract["id"] not in default_ids

    archived_response = client.get(
        "/contracts",
        params={
            "include_archived": True,
        },
    )

    assert archived_response.status_code == 200

    all_ids = {
        item["id"]
        for item in archived_response.json()
    }

    assert contract["id"] in all_ids


def test_contracts_can_be_filtered_by_counterparty(
    client: TestClient,
) -> None:
    first_counterparty = create_counterparty(
        client,
        unp="900000001",
    )
    second_counterparty = create_counterparty(
        client,
        unp="900000002",
    )

    first_contract = create_contract(
        client,
        first_counterparty["id"],
        number="FILTER-001",
    )
    second_contract = create_contract(
        client,
        second_counterparty["id"],
        number="FILTER-002",
    )

    response = client.get(
        "/contracts",
        params={
            "counterparty_id": first_counterparty["id"],
        },
    )

    assert response.status_code == 200

    contracts = response.json()
    contract_ids = {
        contract["id"]
        for contract in contracts
    }

    assert first_contract["id"] in contract_ids
    assert second_contract["id"] not in contract_ids
    assert all(
        contract["counterparty_id"]
        == first_counterparty["id"]
        for contract in contracts
    )


def test_contract_cannot_be_created_for_archived_counterparty(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(client)

    archive_response = client.post(
        f"/counterparties/{counterparty['id']}/archive"
    )

    assert archive_response.status_code == 200

    response = client.post(
        "/contracts",
        json={
            "counterparty_id": counterparty["id"],
            "number": "ARCHIVED-CP-001",
            "title": (
                "Договор с архивным контрагентом"
            ),
            "contract_date": "2026-07-21",
            "currency": "BYN",
            "owner_role": "supplier",
            "counterparty_role": "buyer",
        },
    )

    assert response.status_code == 409


def test_contract_cannot_be_created_for_missing_counterparty(
    client: TestClient,
) -> None:
    response = client.post(
        "/contracts",
        json={
            "counterparty_id": 999999999,
            "number": "MISSING-CP-001",
            "title": "Договор без контрагента",
            "contract_date": "2026-07-21",
            "currency": "BYN",
            "owner_role": "supplier",
            "counterparty_role": "buyer",
        },
    )

    assert response.status_code == 404
    assert response.json() == {
        "detail": "Контрагент не найден",
    }


def test_missing_contract_returns_not_found(
    client: TestClient,
) -> None:
    response = client.get(
        "/contracts/999999999"
    )

    assert response.status_code == 404

    history_response = client.get(
        "/contracts/999999999/status-history"
    )

    assert history_response.status_code == 404

def test_contract_events_include_creation(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(client)
    contract = create_contract(
        client,
        counterparty["id"],
    )

    response = client.get(
        f"/contracts/{contract['id']}/events"
    )

    assert response.status_code == 200

    events = response.json()

    assert len(events) == 1
    assert events[0]["event_type"] == "created"
    assert events[0]["event_data"] == {
        "initial_status": "draft",
    }


def test_contract_update_creates_event(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(client)
    contract = create_contract(
        client,
        counterparty["id"],
    )

    response = client.patch(
        f"/contracts/{contract['id']}",
        json={
            "title": "Новое название",
            "notes": "Новое примечание",
        },
    )

    assert response.status_code == 200

    events_response = client.get(
        f"/contracts/{contract['id']}/events"
    )

    assert events_response.status_code == 200

    events = events_response.json()

    assert len(events) == 2
    assert events[0]["event_type"] == "updated"
    assert events[0]["event_data"] == {
        "changed_fields": [
            "notes",
            "title",
        ],
    }


def test_same_contract_values_do_not_create_update_event(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(client)
    contract = create_contract(
        client,
        counterparty["id"],
    )

    response = client.patch(
        f"/contracts/{contract['id']}",
        json={
            "title": contract["title"],
        },
    )

    assert response.status_code == 200

    events_response = client.get(
        f"/contracts/{contract['id']}/events"
    )

    assert events_response.status_code == 200

    events = events_response.json()

    assert len(events) == 1
    assert events[0]["event_type"] == "created"


def test_status_change_creates_contract_event(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(client)
    contract = create_contract(
        client,
        counterparty["id"],
    )

    response = change_status(
        client,
        contract["id"],
        "pending_approval",
    )

    assert response.status_code == 200

    events_response = client.get(
        f"/contracts/{contract['id']}/events"
    )

    assert events_response.status_code == 200

    events = events_response.json()

    assert len(events) == 2
    assert events[0]["event_type"] == "status_changed"
    assert events[0]["event_data"] == {
        "from_status": "draft",
        "to_status": "pending_approval",
    }


def test_archive_and_restore_create_events(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(client)
    contract = create_contract(
        client,
        counterparty["id"],
    )

    archive_response = client.post(
        f"/contracts/{contract['id']}/archive"
    )

    assert archive_response.status_code == 200

    restore_response = client.post(
        f"/contracts/{contract['id']}/restore"
    )

    assert restore_response.status_code == 200

    events_response = client.get(
        f"/contracts/{contract['id']}/events"
    )

    assert events_response.status_code == 200

    events = events_response.json()

    assert [
        event["event_type"]
        for event in events
    ] == [
        "restored",
        "archived",
        "created",
    ]

    assert events[0]["event_data"]["status"] == "draft"
    assert (
        events[0]["event_data"]["previous_archived_at"]
        is not None
    )

    assert events[1]["event_data"]["status"] == "draft"
    assert (
        events[1]["event_data"]["archived_at"]
        is not None
    )


def test_repeated_status_does_not_create_event(
    client: TestClient,
) -> None:
    counterparty = create_counterparty(client)
    contract = create_contract(
        client,
        counterparty["id"],
    )

    first_response = change_status(
        client,
        contract["id"],
        "pending_approval",
    )

    assert first_response.status_code == 200

    second_response = change_status(
        client,
        contract["id"],
        "pending_approval",
    )

    assert second_response.status_code == 200

    events_response = client.get(
        f"/contracts/{contract['id']}/events"
    )

    assert events_response.status_code == 200

    event_types = [
        event["event_type"]
        for event in events_response.json()
    ]

    assert event_types == [
        "status_changed",
        "created",
    ]


def test_missing_contract_events_return_not_found(
    client: TestClient,
) -> None:
    response = client.get(
        "/contracts/999999999/events"
    )

    assert response.status_code == 404
