import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  render,
  screen,
} from "@testing-library/react";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const apiMocks = vi.hoisted(() => ({
  getVersions: vi.fn(),
  getRuns: vi.fn(),
  getRun: vi.fn(),
  start: vi.fn(),
}));

vi.mock("../../api/contractDocuments", () => ({
  getContractDocumentVersions:
    apiMocks.getVersions,
}));

vi.mock("../../api/contractAnalysis", () => ({
  getContractAnalysisRuns: apiMocks.getRuns,
  getContractAnalysisRun: apiMocks.getRun,
  startContractAnalysis: apiMocks.start,
}));

import {
  CONTRACT_ANALYSIS_POLL_INTERVAL_MS,
  getContractAnalysisPollInterval,
} from "../../utils/contractAnalysisPolling";
import {
  ContractAnalysisTab,
} from "./ContractAnalysisTab";

afterEach(() => {
  vi.clearAllMocks();
});

describe("contract analysis polling", () => {
  it("опрашивает только выполняющийся анализ", () => {
    expect(
      getContractAnalysisPollInterval("running"),
    ).toBe(CONTRACT_ANALYSIS_POLL_INTERVAL_MS);
    expect(
      getContractAnalysisPollInterval("completed"),
    ).toBe(false);
    expect(
      getContractAnalysisPollInterval("failed"),
    ).toBe(false);
  });

  it("не запускает polling до загрузки результата", () => {
    expect(
      getContractAnalysisPollInterval(undefined),
    ).toBe(false);
  });

  it("показывает машинный черновик, риск и проверенную цитату", async () => {
    apiMocks.getVersions.mockResolvedValue({
      items: [
        {
          id: 4,
          contract_id: 7,
          version_number: 2,
          source: "uploaded",
          template_id: null,
          template_name: null,
          template_version: null,
          source_data: {},
          file_name: "contract.docx",
          file_sha256: null,
          file_size_bytes: 1200,
          created_by_user_id: 3,
          created_at: "2026-07-29T10:00:00Z",
        },
      ],
      total: 1,
      limit: 100,
      offset: 0,
    });
    apiMocks.getRuns.mockResolvedValue({
      items: [
        {
          id: 15,
          contract_id: 7,
          document_version_id: 4,
          version_number: 2,
          created_by_user_id: 3,
          status: "completed",
          executor: "openai_compatible",
          model: "qwen3.5:4b",
          policy_id: "promai-contract-analysis-rb",
          policy_version: "1.0.0",
          policy_sha256: "a".repeat(64),
          source_file_sha256: "b".repeat(64),
          extracted_text_sha256: "c".repeat(64),
          result_id: "result-15",
          result_status: "machine_draft",
          requires_human_review: true,
          content_sha256: "d".repeat(64),
          error_code: null,
          error_message: null,
          started_at: "2026-07-29T10:01:00Z",
          completed_at: "2026-07-29T10:02:00Z",
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
    apiMocks.getRun.mockResolvedValue({
      ...(await apiMocks.getRuns()).items[0],
      findings: [
        {
          id: 31,
          finding_id: "payment-1",
          ordinal: 1,
          category: "payment",
          severity_level: "high",
          title: "Неопределённый срок оплаты",
          description:
            "Условие требует проверки менеджером.",
          content_sha256: "e".repeat(64),
          evidence_references: [
            {
              id: 41,
              ordinal: 1,
              block_id: "block-1",
              block_ordinal: 2,
              start_character: 0,
              end_character: 31,
              quote:
                "Оплата производится после поставки",
              quote_sha256: "f".repeat(64),
            },
          ],
        },
      ],
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ContractAnalysisTab contractId={7} />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("Машинный черновик"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Неопределённый срок оплаты",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Требуется проверка человеком",
      ),
    ).toBeInTheDocument();

    screen
      .getByText(/Подтверждающие цитаты/)
      .click();

    expect(
      screen.getByText(
        "«Оплата производится после поставки»",
      ),
    ).toBeInTheDocument();
  });
});
