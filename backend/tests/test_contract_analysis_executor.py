import json
from hashlib import sha256
from pathlib import Path

import httpx
import pytest
from pydantic import SecretStr

from app.core.config import Settings
from app.services import (
    contract_analysis_evidence,
    contract_analysis_executor,
    contract_analysis_findings,
)
from app.services.contract_analysis_input import (
    ContractAnalysisInput,
)


def build_evidence_index():
    text = (
        "[BODY]\nДоговор\n\n"
        "Оплата производится в течение 10 дней. "
        "Оплата производится после поставки."
    )

    return build_evidence_index_from_text(text)


def build_evidence_index_from_text(text: str):
    encoded = text.encode("utf-8")
    analysis_input = ContractAnalysisInput(
        contract_id=17,
        document_version_id=41,
        version_number=3,
        file_name="Договор.docx",
        source="uploaded",
        source_file_sha256=sha256(
            b"docx"
        ).hexdigest(),
        extracted_text_sha256=sha256(
            encoded
        ).hexdigest(),
        source_file_size_bytes=4,
        extracted_text_characters=len(text),
        extracted_text_size_bytes=len(encoded),
        text=text,
    )

    return (
        contract_analysis_evidence
        .build_contract_analysis_evidence_index(
            analysis_input
        )
    )


def build_policy():
    return (
        contract_analysis_findings
        .ContractAnalysisFindingsPolicy(
            policy_id="pilot",
            policy_version="1",
            allowed_categories=("payment",),
            allowed_severity_levels=("medium",),
        )
    )


def write_policy(path: Path) -> None:
    path.write_text(
        json.dumps(
            {
                "policy_id": "pilot",
                "policy_version": "1",
                "allowed_categories": [
                    "payment"
                ],
                "allowed_severity_levels": [
                    "medium"
                ],
            }
        ),
        encoding="utf-8",
    )


def test_load_policy_and_build_enabled_context(
    tmp_path: Path,
) -> None:
    policy_path = tmp_path / "policy.json"
    write_policy(policy_path)
    settings = Settings(
        database_url="sqlite://",
        auth_secret_key=SecretStr("x" * 32),
        contract_analysis_enabled=True,
        contract_analysis_api_base_url=(
            "http://llm.local/v1"
        ),
        contract_analysis_model="local-model",
        contract_analysis_api_key=SecretStr(
            "test-key"
        ),
        contract_analysis_timeout_seconds=15,
        contract_analysis_batch_max_characters=6_000,
        contract_analysis_max_output_tokens=1_400,
        contract_analysis_policy_path=str(
            policy_path
        ),
    )

    context = (
        contract_analysis_executor
        .get_contract_analysis_execution_context(
            settings
        )
    )

    assert context.policy == build_policy()
    assert context.executor.executor_name == (
        "openai_compatible_v1"
    )
    assert context.executor.model == "local-model"
    assert context.executor.api_base_url == (
        "http://llm.local/v1"
    )
    assert context.executor.timeout_seconds == 15
    assert (
        context.executor
        .batch_max_characters
        == 6_000
    )
    assert (
        context.executor.max_output_tokens
        == 1_400
    )


def test_disabled_and_invalid_configuration_are_rejected(
    tmp_path: Path,
) -> None:
    base_settings = Settings(
        database_url="sqlite://",
        auth_secret_key=SecretStr("x" * 32),
        contract_analysis_enabled=False,
    )

    with pytest.raises(
        contract_analysis_executor
        .ContractAnalysisDisabledError
    ):
        (
            contract_analysis_executor
            .get_contract_analysis_execution_context(
                base_settings
            )
        )

    policy_path = tmp_path / "policy.json"
    write_policy(policy_path)
    enabled = base_settings.model_copy(
        update={
            "contract_analysis_enabled": True,
            "contract_analysis_api_base_url": (
                "file:///tmp/provider"
            ),
            "contract_analysis_model": "model",
            "contract_analysis_api_key": (
                SecretStr("key")
            ),
            "contract_analysis_policy_path": str(
                policy_path
            ),
        }
    )

    with pytest.raises(
        contract_analysis_executor
        .ContractAnalysisConfigurationError
    ):
        (
            contract_analysis_executor
            .get_contract_analysis_execution_context(
                enabled
            )
        )


@pytest.mark.parametrize(
    "payload",
    [
        {"findings": "not-a-list"},
        {"findings": [], "raw": "forbidden"},
        {
            "findings": [
                {
                    "category": "payment",
                    "severity_level": "medium",
                    "title": "Оплата",
                    "description": "Описание",
                    "evidence": [],
                }
            ]
        },
    ],
)
def test_invalid_executor_payload_is_rejected(
    payload: object,
) -> None:
    with pytest.raises(
        contract_analysis_executor
        .InvalidContractAnalysisExecutorResponseError
    ):
        (
            contract_analysis_executor
            .parse_executor_findings(
                payload=payload,
                evidence_index=(
                    build_evidence_index()
                ),
            )
        )


def test_quote_occurrence_is_resolved_by_backend(
) -> None:
    evidence_index = build_evidence_index()
    block = evidence_index.blocks[1]
    quote = "Оплата производится"
    drafts = (
        contract_analysis_executor
        .parse_executor_findings(
            payload={
                "findings": [
                    {
                        "category": "payment",
                        "severity_level": "medium",
                        "title": "Порядок оплаты",
                        "description": (
                            "Условие требует проверки"
                        ),
                        "evidence": [
                            {
                                "block_id": (
                                    block.block_id
                                ),
                                "quote": quote,
                                "occurrence": 2,
                            }
                        ],
                    }
                ]
            },
            evidence_index=evidence_index,
        )
    )
    reference = drafts[0].evidence_references[0]
    first_relative = block.text.find(quote)
    second_relative = block.text.find(
        quote,
        first_relative + 1,
    )

    assert reference.start_character == (
        block.start_character + second_relative
    )
    assert reference.end_character == (
        reference.start_character + len(quote)
    )
    assert reference.quote == quote


def test_unique_quote_recovers_wrong_occurrence(
) -> None:
    evidence_index = build_evidence_index()
    block = evidence_index.blocks[1]
    quote = "10 дней"
    drafts = (
        contract_analysis_executor
        .parse_executor_findings(
            payload={
                "findings": [
                    {
                        "category": "payment",
                        "severity_level": "medium",
                        "title": "Срок оплаты",
                        "description": (
                            "Условие требует проверки"
                        ),
                        "evidence": [
                            {
                                "block_id": (
                                    block.block_id
                                ),
                                "quote": quote,
                                "occurrence": 8,
                            }
                        ],
                    }
                ]
            },
            evidence_index=evidence_index,
        )
    )

    reference = drafts[0].evidence_references[0]

    assert reference.start_character == (
        block.start_character
        + block.text.index(quote)
    )
    assert reference.quote == quote


def test_inexact_evidence_discards_only_its_finding(
) -> None:
    evidence_index = build_evidence_index()
    block = evidence_index.blocks[1]
    drafts = (
        contract_analysis_executor
        .parse_executor_findings(
            payload={
                "findings": [
                    {
                        "category": "payment",
                        "severity_level": "medium",
                        "title": "Неточная цитата",
                        "description": (
                            "Не должна попасть в результат"
                        ),
                        "evidence": [
                            {
                                "block_id": (
                                    block.block_id
                                ),
                                "quote": (
                                    "Оплата выполняется "
                                    "после поставки"
                                ),
                                "occurrence": 1,
                            }
                        ],
                    },
                    {
                        "category": "payment",
                        "severity_level": "medium",
                        "title": "Точная цитата",
                        "description": (
                            "Должна попасть в результат"
                        ),
                        "evidence": [
                            {
                                "block_id": (
                                    block.block_id
                                ),
                                "quote": "после поставки",
                                "occurrence": 7,
                            }
                        ],
                    },
                ]
            },
            evidence_index=evidence_index,
        )
    )

    assert len(drafts) == 1
    assert drafts[0].title == "Точная цитата"
    assert (
        drafts[0].evidence_references[0].quote
        == "после поставки"
    )


def test_ambiguous_quote_rejects_wrong_occurrence(
) -> None:
    with pytest.raises(
        contract_analysis_executor
        .InvalidContractAnalysisExecutorResponseError
    ):
        (
            contract_analysis_executor
            .find_quote_occurrence(
                block_text="Оплата. Оплата.",
                quote="Оплата",
                occurrence=3,
            )
        )


def test_openai_compatible_executor_uses_strict_schema(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    evidence_index = build_evidence_index()
    block = evidence_index.blocks[1]
    captured: dict[str, object] = {}

    def fake_post(
        url: str,
        **kwargs,
    ) -> httpx.Response:
        captured["url"] = url
        captured.update(kwargs)
        request_payload = kwargs["json"]
        analysis_payload = json.loads(
            request_payload["messages"][1][
                "content"
            ]
        )
        model_block_id = next(
            evidence_block["block_id"]
            for evidence_block
            in analysis_payload["evidence_blocks"]
            if "10 дней"
            in evidence_block["text"]
        )
        request = httpx.Request(
            "POST",
            url,
        )
        return httpx.Response(
            200,
            request=request,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "findings": [
                                        {
                                            "category": "payment",
                                            "severity_level": "medium",
                                            "title": "Оплата",
                                            "description": "Проверить срок",
                                            "evidence": [
                                                {
                                                    "block_id": model_block_id,
                                                    "quote": "10 дней",
                                                    "occurrence": 1,
                                                }
                                            ],
                                        }
                                    ]
                                },
                                ensure_ascii=False,
                            )
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr(
        contract_analysis_executor.httpx,
        "post",
        fake_post,
    )
    executor = (
        contract_analysis_executor
        .OpenAICompatibleContractAnalysisExecutor(
            api_base_url="http://llm.local/v1",
            api_key="secret",
            model="model",
            timeout_seconds=10,
        )
    )

    drafts = executor.execute(
        evidence_index=evidence_index,
        policy=build_policy(),
    )

    assert len(drafts) == 1
    assert captured["url"] == (
        "http://llm.local/v1/chat/completions"
    )
    assert captured["headers"] == {
        "Authorization": "Bearer secret",
        "Content-Type": "application/json",
    }
    request_payload = captured["json"]
    assert (
        request_payload["reasoning_effort"]
        == "none"
    )
    assert request_payload["max_tokens"] == 1_600
    response_format = request_payload[
        "response_format"
    ]
    assert response_format["type"] == (
        "json_schema"
    )
    json_schema = response_format["json_schema"]
    assert json_schema["strict"] is True
    schema = json_schema["schema"]
    assert schema["additionalProperties"] is False
    assert (
        schema["properties"]["findings"][
            "maxItems"
        ]
        == 4
    )
    finding_schema = (
        schema["properties"]["findings"]["items"]
    )
    assert (
        finding_schema["additionalProperties"]
        is False
    )
    assert (
        finding_schema["properties"]["category"][
            "enum"
        ]
        == ["payment"]
    )
    assert (
        finding_schema["properties"]["title"][
            "maxLength"
        ]
        == 120
    )
    assert (
        finding_schema["properties"]["description"][
            "maxLength"
        ]
        == 300
    )
    assert (
        finding_schema["properties"]["evidence"][
            "maxItems"
        ]
        == 2
    )
    evidence_schema = (
        finding_schema["properties"]["evidence"][
            "items"
        ]
    )
    assert evidence_schema[
        "additionalProperties"
    ] is False
    assert evidence_schema["properties"][
        "block_id"
    ]["enum"] == [
        f"b{ordinal}"
        for ordinal, _block in enumerate(
            evidence_index.blocks,
            start=1,
        )
    ]
    assert (
        evidence_schema["properties"]["quote"][
            "maxLength"
        ]
        == 240
    )
    assert evidence_index.blocks[1].text in (
        request_payload["messages"][1]["content"]
    )
    analysis_payload = json.loads(
        request_payload["messages"][1][
            "content"
        ]
    )
    assert [
        evidence_block["block_id"]
        for evidence_block
        in analysis_payload["evidence_blocks"]
    ] == [
        f"b{ordinal}"
        for ordinal, _block in enumerate(
            evidence_index.blocks,
            start=1,
        )
    ]
    assert all(
        block.block_id
        not in request_payload["messages"][1][
            "content"
        ]
        for block in evidence_index.blocks
    )
    assert (
        drafts[0].evidence_references[0].block_id
        == block.block_id
    )
    assert "occurrence — это не номер вывода" in (
        request_payload["messages"][0]["content"]
    )
    assert "не более 4 наиболее" in (
        request_payload["messages"][0]["content"]
    )
    assert "пометкой «продолжение»" in (
        request_payload["messages"][0]["content"]
    )
    assert "две разные цитаты" in (
        request_payload["messages"][0]["content"]
    )
    assert "нормативные источники не переданы" in (
        request_payload["messages"][0]["content"]
    )
    assert "Не добавляй числа, которых нет" in (
        request_payload["messages"][0]["content"]
    )
    assert "не только фрагмент срока" in (
        request_payload["messages"][0]["content"]
    )
    assert "одно наиболее значимое замечание" in (
        request_payload["messages"][0]["content"]
    )
    assert "начало срока неопределённым" in (
        request_payload["messages"][0]["content"]
    )
    assert "прямо требует сохранности" in (
        request_payload["messages"][0]["content"]
    )
    assert "Само различие формул" in (
        request_payload["messages"][0]["content"]
    )
    assert "сроки последовательных этапов" in (
        request_payload["messages"][0]["content"]
    )
    assert "до полного исполнения" in (
        request_payload["messages"][0]["content"]
    )
    assert "для несогласованных сроков" in (
        request_payload["messages"][0]["content"]
    )


def test_executor_batches_blocks_and_preserves_quote_offsets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    text = (
        "[BODY]\n"
        + "Вводная часть. " * 8
        + "Условие оплаты действует 10 дней."
    )
    evidence_index = (
        build_evidence_index_from_text(text)
    )
    requests: list[dict[str, object]] = []

    def fake_post(
        url: str,
        **kwargs,
    ) -> httpx.Response:
        request_payload = kwargs["json"]
        requests.append(request_payload)
        analysis_payload = json.loads(
            request_payload["messages"][1][
                "content"
            ]
        )
        batch_number = analysis_payload[
            "analysis_scope"
        ]["batch_number"]
        evidence_block = analysis_payload[
            "evidence_blocks"
        ][0]
        quote = (
            "Условие оплаты"
            if "Условие оплаты"
            in evidence_block["text"]
            else evidence_block["text"][
                :10
            ].strip()
        )
        request = httpx.Request("POST", url)
        return httpx.Response(
            200,
            request=request,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "findings": [
                                        {
                                            "category": "payment",
                                            "severity_level": "medium",
                                            "title": (
                                                "Пакет "
                                                f"{batch_number}"
                                            ),
                                            "description": (
                                                "Подтверждённое "
                                                "условие"
                                            ),
                                            "evidence": [
                                                {
                                                    "block_id": (
                                                        evidence_block[
                                                            "block_id"
                                                        ]
                                                    ),
                                                    "quote": quote,
                                                    "occurrence": 1,
                                                }
                                            ],
                                        }
                                    ]
                                },
                                ensure_ascii=False,
                            )
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr(
        contract_analysis_executor.httpx,
        "post",
        fake_post,
    )
    executor = (
        contract_analysis_executor
        .OpenAICompatibleContractAnalysisExecutor(
            api_base_url="http://llm.local/v1",
            api_key="secret",
            model="model",
            timeout_seconds=10,
            batch_max_characters=110,
        )
    )

    drafts = executor.execute(
        evidence_index=evidence_index,
        policy=build_policy(),
    )

    assert len(requests) > 1
    assert len(drafts) == len(requests)
    for ordinal, request_payload in enumerate(
        requests,
        start=1,
    ):
        analysis_payload = json.loads(
            request_payload["messages"][1][
                "content"
            ]
        )
        assert analysis_payload[
            "analysis_scope"
        ] == {
            "batch_number": ordinal,
            "batch_count": len(requests),
        }

    quote_draft = next(
        draft
        for draft in drafts
        if draft.evidence_references[0].quote
        == "Условие оплаты"
    )
    reference = quote_draft.evidence_references[
        0
    ]
    assert reference.start_character == (
        text.index("Условие оплаты")
    )
    assert reference.end_character == (
        reference.start_character
        + len("Условие оплаты")
    )


def test_short_block_aliases_keep_small_contract_in_one_batch(
) -> None:
    text = "\n\n".join(
        (
            f"{ordinal}. Условие договора содержит "
            "согласованный порядок исполнения."
        )
        for ordinal in range(1, 23)
    )
    evidence_index = build_evidence_index_from_text(
        text
    )

    batches = (
        contract_analysis_executor
        .build_evidence_batches(
            evidence_index=evidence_index,
            max_characters=6_000,
        )
    )

    assert len(evidence_index.blocks) == 22
    assert len(batches) == 1
    assert len(batches[0]) == 22
    assert (
        sum(
            contract_analysis_executor
            .estimate_evidence_segment_characters(
                segment
            )
            for segment in batches[0]
        )
        <= 6_000
    )


def test_repository_policy_file_is_valid() -> None:
    policy_path = (
        Path(__file__).parents[1]
        / "config"
        / "contract_analysis_policy.v1.json"
    )

    policy = (
        contract_analysis_executor
        .load_contract_analysis_policy(
            str(policy_path)
        )
    )

    assert policy.policy_id == (
        "promai-contract-analysis-rb"
    )
    assert "payment" in policy.allowed_categories
    assert "critical" in (
        policy.allowed_severity_levels
    )


def test_executor_transport_failure_is_classified(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    executor = (
        contract_analysis_executor
        .OpenAICompatibleContractAnalysisExecutor(
            api_base_url="http://llm.local/v1",
            api_key="secret",
            model="model",
            timeout_seconds=10,
        )
    )

    def unavailable(*_args, **_kwargs):
        raise httpx.ConnectError(
            "raw provider failure"
        )

    monkeypatch.setattr(
        contract_analysis_executor.httpx,
        "post",
        unavailable,
    )

    with pytest.raises(
        contract_analysis_executor
        .ContractAnalysisExecutorUnavailableError
    ):
        executor.execute(
            evidence_index=build_evidence_index(),
            policy=build_policy(),
        )
