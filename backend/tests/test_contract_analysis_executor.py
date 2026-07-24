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


def test_disabled_and_invalid_configuration_are_rejected(
    tmp_path: Path,
) -> None:
    base_settings = Settings(
        database_url="sqlite://",
        auth_secret_key=SecretStr("x" * 32),
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


def test_openai_compatible_executor_uses_json_only(
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
                                                    "block_id": block.block_id,
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
    assert request_payload["response_format"] == {
        "type": "json_object"
    }
    assert evidence_index.blocks[1].text in (
        request_payload["messages"][1]["content"]
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
