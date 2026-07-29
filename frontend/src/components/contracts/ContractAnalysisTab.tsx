import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  FileSearch,
  RefreshCw,
  SearchCheck,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getContractAnalysisRun,
  getContractAnalysisRuns,
  startContractAnalysis,
} from "../../api/contractAnalysis";
import { ApiError } from "../../api/client";
import {
  getContractDocumentVersions,
} from "../../api/contractDocuments";
import {
  contractAnalysisSeverityLabels,
  contractAnalysisStatusLabels,
  getContractAnalysisCategoryLabel,
} from "../../constants/contractAnalysis";
import type {
  ContractAnalysisFinding,
  ContractAnalysisRun,
  ContractAnalysisRunStatus,
  ContractAnalysisRunSummary,
  ContractAnalysisSeverity,
} from "../../types/contractAnalysis";
import type { Page } from "../../types/pagination";
import {
  getFailedAnalysisId,
} from "../../utils/apiErrors";
import {
  CONTRACT_ANALYSIS_POLL_INTERVAL_MS,
  getContractAnalysisPollInterval,
} from "../../utils/contractAnalysisPolling";
import {
  formatDateTime,
} from "../../utils/formatters";

const severityRank: Record<
  ContractAnalysisSeverity,
  number
> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function actorLabel(
  userId: number | null,
): string {
  return userId
    ? `Пользователь #${userId}`
    : "Система";
}

function AnalysisStatusIcon({
  status,
}: {
  status: ContractAnalysisRunStatus;
}) {
  if (status === "completed") {
    return (
      <CheckCircle2 size={18} aria-hidden="true" />
    );
  }

  if (status === "failed") {
    return <XCircle size={18} aria-hidden="true" />;
  }

  return <Clock3 size={18} aria-hidden="true" />;
}

function AnalysisRunList({
  items,
  activeAnalysisId,
  onSelect,
}: {
  items: ContractAnalysisRunSummary[];
  activeAnalysisId: number | null;
  onSelect: (analysisId: number) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="contract-analysis-history-empty">
        Запусков для этой версии пока нет.
      </div>
    );
  }

  return (
    <ol className="contract-analysis-history">
      {items.map((run) => (
        <li key={run.id}>
          <button
            type="button"
            className={
              activeAnalysisId === run.id
                ? "contract-analysis-run contract-analysis-run--active"
                : "contract-analysis-run"
            }
            onClick={() => onSelect(run.id)}
          >
            <span
              className={`contract-analysis-run__status contract-analysis-run__status--${run.status}`}
            >
              <AnalysisStatusIcon status={run.status} />
            </span>
            <span>
              <strong>
                Анализ #{run.id}
              </strong>
              <small>
                {formatDateTime(run.started_at)}
              </small>
            </span>
            <span
              className={`status-badge contract-analysis-status--${run.status}`}
            >
              {contractAnalysisStatusLabels[run.status]}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function AnalysisFindingCard({
  finding,
}: {
  finding: ContractAnalysisFinding;
}) {
  return (
    <article
      className={`contract-finding contract-finding--${finding.severity_level}`}
    >
      <div className="contract-finding__heading">
        <div>
          <span
            className={`contract-severity contract-severity--${finding.severity_level}`}
          >
            {
              contractAnalysisSeverityLabels[
                finding.severity_level
              ]
            }
          </span>
          <span className="contract-finding__category">
            {getContractAnalysisCategoryLabel(
              finding.category,
            )}
          </span>
        </div>
        <span className="contract-finding__number">
          #{finding.ordinal}
        </span>
      </div>

      <h3>{finding.title}</h3>
      <p>{finding.description}</p>

      <details className="contract-evidence">
        <summary>
          <SearchCheck size={16} aria-hidden="true" />
          Подтверждающие цитаты (
          {finding.evidence_references.length})
        </summary>
        <div>
          {finding.evidence_references.map(
            (evidence) => (
              <blockquote key={evidence.id}>
                <p>«{evidence.quote}»</p>
                <footer>
                  Проверенный фрагмент документа · блок{" "}
                  {evidence.block_ordinal}
                </footer>
              </blockquote>
            ),
          )}
        </div>
      </details>
    </article>
  );
}

function AnalysisResult({
  analysis,
  onRetry,
  isRetrying,
}: {
  analysis: ContractAnalysisRun;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  const findings = useMemo(
    () =>
      [...analysis.findings].sort(
        (left, right) =>
          severityRank[right.severity_level] -
            severityRank[left.severity_level] ||
          left.ordinal - right.ordinal,
      ),
    [analysis.findings],
  );

  if (analysis.status === "running") {
    return (
      <div
        className="contract-analysis-progress"
        role="status"
      >
        <span className="contract-analysis-spinner">
          <Bot size={27} aria-hidden="true" />
        </span>
        <div>
          <strong>
            Анализ версии {analysis.version_number}
            выполняется
          </strong>
          <p>
            PromAI проверяет условия договора и
            подтверждает каждое замечание точной
            цитатой. Страница обновится автоматически.
          </p>
        </div>
      </div>
    );
  }

  if (analysis.status === "failed") {
    return (
      <div className="contract-analysis-failed">
        <span>
          <XCircle size={25} aria-hidden="true" />
        </span>
        <div>
          <strong>Анализ завершился ошибкой</strong>
          <p>
            {analysis.error_message ||
              "Исполнитель анализа временно недоступен"}
          </p>
          {analysis.error_code && (
            <small>
              Код: {analysis.error_code}
            </small>
          )}
          <button
            type="button"
            className="button button--secondary"
            disabled={isRetrying}
            onClick={onRetry}
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
            />
            Запустить повторно
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="contract-analysis-result">
      <div className="contract-analysis-warnings">
        <div>
          <Bot size={19} aria-hidden="true" />
          <span>
            <strong>Машинный черновик</strong>
            Результат не является юридическим
            заключением.
          </span>
        </div>
        <div>
          <AlertTriangle
            size={19}
            aria-hidden="true"
          />
          <span>
            <strong>Требуется проверка человеком</strong>
            Сопоставьте замечания с оригиналом
            договора.
          </span>
        </div>
      </div>

      <dl className="contract-analysis-meta">
        <div>
          <dt>Модель</dt>
          <dd>{analysis.model}</dd>
        </div>
        <div>
          <dt>Политика</dt>
          <dd>
            {analysis.policy_id} v
            {analysis.policy_version}
          </dd>
        </div>
        <div>
          <dt>Инициатор</dt>
          <dd>
            {actorLabel(analysis.created_by_user_id)}
          </dd>
        </div>
        <div>
          <dt>Завершён</dt>
          <dd>
            {formatDateTime(analysis.completed_at)}
          </dd>
        </div>
      </dl>

      <div className="contract-findings-heading">
        <div>
          <span className="section-kicker">
            Доказуемые замечания
          </span>
          <h3>
            Выявлено: {findings.length}
          </h3>
        </div>
      </div>

      {findings.length > 0 ? (
        <div className="contract-findings">
          {findings.map((finding) => (
            <AnalysisFindingCard
              key={finding.id}
              finding={finding}
            />
          ))}
        </div>
      ) : (
        <div className="contract-analysis-clean">
          <CheckCircle2
            size={24}
            aria-hidden="true"
          />
          <div>
            <strong>
              Доказуемые риски не обнаружены
            </strong>
            <span>
              Это не отменяет обязательную проверку
              документа специалистом.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

interface ContractAnalysisTabProps {
  contractId: number;
  requestedVersionNumber?: number;
}

export function ContractAnalysisTab({
  contractId,
  requestedVersionNumber,
}: ContractAnalysisTabProps) {
  const queryClient = useQueryClient();
  const [
    selectedVersionNumber,
    setSelectedVersionNumber,
  ] = useState<number | null>(
    requestedVersionNumber ?? null,
  );
  const [selectedAnalysisId, setSelectedAnalysisId] =
    useState<number | null>(null);
  const [
    startingVersionNumber,
    setStartingVersionNumber,
  ] = useState<number | null>(null);

  const versionsQuery = useQuery({
    queryKey: [
      "contract",
      contractId,
      "versions",
    ],
    queryFn: () =>
      getContractDocumentVersions(contractId),
  });

  useEffect(() => {
    const versions = versionsQuery.data?.items;

    if (!versions?.length) {
      return;
    }

    setSelectedVersionNumber((current) => {
      if (
        current &&
        versions.some(
          (version) =>
            version.version_number === current,
        )
      ) {
        return current;
      }

      if (
        requestedVersionNumber &&
        versions.some(
          (version) =>
            version.version_number ===
            requestedVersionNumber,
        )
      ) {
        return requestedVersionNumber;
      }

      return versions[0].version_number;
    });
  }, [
    requestedVersionNumber,
    versionsQuery.data,
  ]);

  const runsQuery = useQuery({
    queryKey: [
      "contract",
      contractId,
      "version",
      selectedVersionNumber,
      "analyses",
    ],
    queryFn: () =>
      getContractAnalysisRuns(
        contractId,
        selectedVersionNumber!,
      ),
    enabled: Boolean(selectedVersionNumber),
    refetchInterval:
      startingVersionNumber === selectedVersionNumber
        ? CONTRACT_ANALYSIS_POLL_INTERVAL_MS
        : false,
  });

  const activeAnalysisId =
    selectedAnalysisId ??
    runsQuery.data?.items[0]?.id ??
    null;

  const analysisQuery = useQuery({
    queryKey: [
      "contract",
      contractId,
      "version",
      selectedVersionNumber,
      "analysis",
      activeAnalysisId,
    ],
    queryFn: () =>
      getContractAnalysisRun(
        contractId,
        selectedVersionNumber!,
        activeAnalysisId!,
      ),
    enabled: Boolean(
      selectedVersionNumber && activeAnalysisId,
    ),
    refetchInterval: (query) =>
      getContractAnalysisPollInterval(
        (
          query.state.data as
            | ContractAnalysisRun
            | undefined
        )?.status,
      ),
  });

  useEffect(() => {
    const analysis = analysisQuery.data;

    if (
      !analysis ||
      analysis.status === "running" ||
      !selectedVersionNumber
    ) {
      return;
    }

    queryClient.setQueryData<
      Page<ContractAnalysisRunSummary>
    >(
      [
        "contract",
        contractId,
        "version",
        selectedVersionNumber,
        "analyses",
      ],
      (current) =>
        current
          ? {
              ...current,
              items: current.items.map((run) =>
                run.id === analysis.id
                  ? analysis
                  : run,
              ),
            }
          : current,
    );
  }, [
    analysisQuery.data,
    contractId,
    queryClient,
    selectedVersionNumber,
  ]);

  const startMutation = useMutation({
    mutationFn: (versionNumber: number) =>
      startContractAnalysis(
        contractId,
        versionNumber,
      ),
    onMutate: (versionNumber) => {
      setStartingVersionNumber(versionNumber);
      setSelectedAnalysisId(null);
    },
    onSuccess: async (analysis) => {
      setSelectedAnalysisId(analysis.id);
      queryClient.setQueryData(
        [
          "contract",
          contractId,
          "version",
          analysis.version_number,
          "analysis",
          analysis.id,
        ],
        analysis,
      );
      await queryClient.invalidateQueries({
        queryKey: [
          "contract",
          contractId,
          "version",
          analysis.version_number,
          "analyses",
        ],
      });
    },
    onError: async (error) => {
      const failedAnalysisId =
        getFailedAnalysisId(error);

      if (failedAnalysisId) {
        setSelectedAnalysisId(failedAnalysisId);
      }

      if (selectedVersionNumber) {
        await queryClient.invalidateQueries({
          queryKey: [
            "contract",
            contractId,
            "version",
            selectedVersionNumber,
          ],
        });
      }
    },
    onSettled: () => {
      setStartingVersionNumber(null);
    },
  });

  const versions =
    versionsQuery.data?.items ?? [];
  const isStarting =
    startMutation.isPending &&
    startingVersionNumber === selectedVersionNumber;
  const isCurrentRunActive =
    analysisQuery.data?.status === "running";
  const isQueueConflict =
    startMutation.error instanceof ApiError &&
    startMutation.error.status === 409;

  function startSelectedAnalysis() {
    if (selectedVersionNumber) {
      startMutation.reset();
      startMutation.mutate(selectedVersionNumber);
    }
  }

  if (versionsQuery.isLoading) {
    return (
      <section className="detail-card contract-tab-panel">
        <div
          className="contract-tab-loading"
          role="status"
        >
          <span className="loading-spinner" />
          Загружаем версии для анализа…
        </div>
      </section>
    );
  }

  if (versionsQuery.isError) {
    return (
      <section className="detail-card contract-tab-panel">
        <div className="contract-tab-error">
          <strong>Не удалось загрузить версии</strong>
          <span>
            {versionsQuery.error instanceof Error
              ? versionsQuery.error.message
              : "Повторите запрос"}
          </span>
          <button
            type="button"
            onClick={() => {
              void versionsQuery.refetch();
            }}
          >
            Повторить
          </button>
        </div>
      </section>
    );
  }

  if (versions.length === 0) {
    return (
      <section className="detail-card contract-tab-panel">
        <div className="contract-tab-empty">
          <FileSearch size={30} aria-hidden="true" />
          <strong>Нет версии для анализа</strong>
          <span>
            Сначала сгенерируйте или загрузите DOCX во
            вкладке «Документ».
          </span>
        </div>
      </section>
    );
  }

  return (
    <div className="contract-analysis-layout">
      <aside className="detail-card contract-analysis-sidebar">
        <div className="detail-card__heading">
          <div>
            <span className="section-kicker">
              История запусков
            </span>
            <h2>AI-анализ</h2>
          </div>
        </div>

        <label className="record-field contract-analysis-version">
          <span>Версия документа</span>
          <select
            value={selectedVersionNumber ?? ""}
            onChange={(event) => {
              setSelectedVersionNumber(
                Number(event.target.value),
              );
              setSelectedAnalysisId(null);
              startMutation.reset();
            }}
          >
            {versions.map((version) => (
              <option
                key={version.id}
                value={version.version_number}
              >
                Версия {version.version_number} ·{" "}
                {version.file_name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="button button--primary contract-analysis-start"
          disabled={
            !selectedVersionNumber ||
            isStarting ||
            isCurrentRunActive
          }
          onClick={startSelectedAnalysis}
        >
          {isStarting ? (
            <span
              className="button-spinner"
              aria-hidden="true"
            />
          ) : (
            <Bot size={17} aria-hidden="true" />
          )}
          {isStarting
            ? "Анализируем…"
            : "Запустить анализ"}
        </button>

        {runsQuery.isLoading && (
          <div
            className="contract-analysis-history-loading"
            role="status"
          >
            <span className="loading-spinner" />
            Загружаем историю…
          </div>
        )}

        {runsQuery.isError && (
          <div className="contract-analysis-history-error">
            <span>
              {runsQuery.error instanceof Error
                ? runsQuery.error.message
                : "Не удалось загрузить историю"}
            </span>
            <button
              type="button"
              onClick={() => {
                void runsQuery.refetch();
              }}
            >
              Повторить
            </button>
          </div>
        )}

        {runsQuery.data && (
          <AnalysisRunList
            items={runsQuery.data.items}
            activeAnalysisId={activeAnalysisId}
            onSelect={setSelectedAnalysisId}
          />
        )}
      </aside>

      <section className="detail-card contract-analysis-main">
        <div className="detail-card__heading">
          <div>
            <span className="section-kicker">
              Версия {selectedVersionNumber}
            </span>
            <h2>Результат проверки</h2>
          </div>
          {analysisQuery.data && (
            <span
              className={`status-badge contract-analysis-status--${analysisQuery.data.status}`}
            >
              {
                contractAnalysisStatusLabels[
                  analysisQuery.data.status
                ]
              }
            </span>
          )}
        </div>

        {isQueueConflict && (
          <div
            className="contract-analysis-queue"
            role="alert"
          >
            <Clock3 size={20} aria-hidden="true" />
            <div>
              <strong>
                Общая очередь анализа занята
              </strong>
              <span>
                В PromAI уже выполняется другой анализ.
                Дождитесь его завершения и повторите
                запуск.
              </span>
            </div>
          </div>
        )}

        {startMutation.isError &&
          !isQueueConflict &&
          !getFailedAnalysisId(
            startMutation.error,
          ) && (
            <div
              className="contract-analysis-queue contract-analysis-queue--error"
              role="alert"
            >
              <AlertTriangle
                size={20}
                aria-hidden="true"
              />
              <div>
                <strong>
                  Не удалось запустить анализ
                </strong>
                <span>
                  {startMutation.error instanceof Error
                    ? startMutation.error.message
                    : "Повторите попытку"}
                </span>
              </div>
            </div>
          )}

        {analysisQuery.isLoading &&
          activeAnalysisId && (
            <div
              className="contract-tab-loading"
              role="status"
            >
              <span className="loading-spinner" />
              Загружаем результат…
            </div>
          )}

        {analysisQuery.isError && (
          <div className="contract-tab-error">
            <strong>
              Не удалось загрузить результат
            </strong>
            <span>
              {analysisQuery.error instanceof Error
                ? analysisQuery.error.message
                : "Повторите запрос"}
            </span>
            <button
              type="button"
              onClick={() => {
                void analysisQuery.refetch();
              }}
            >
              Повторить
            </button>
          </div>
        )}

        {analysisQuery.data && (
          <AnalysisResult
            analysis={analysisQuery.data}
            isRetrying={isStarting}
            onRetry={startSelectedAnalysis}
          />
        )}

        {!activeAnalysisId &&
          !analysisQuery.isLoading && (
            <div className="contract-tab-empty">
              <FileSearch
                size={30}
                aria-hidden="true"
              />
              <strong>
                Выберите или запустите анализ
              </strong>
              <span>
                PromAI покажет только замечания,
                подтверждённые точными цитатами из
                выбранной версии DOCX.
              </span>
            </div>
          )}
      </section>
    </div>
  );
}
