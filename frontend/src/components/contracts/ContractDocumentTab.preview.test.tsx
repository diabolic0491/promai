import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const apiMocks = vi.hoisted(() => ({
  downloadLatest: vi.fn(),
  generate: vi.fn(),
  getVersions: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("../../api/contractDocuments", () => ({
  downloadLatestContractDocument:
    apiMocks.downloadLatest,
  generateContractDocument: apiMocks.generate,
  getContractDocumentVersions:
    apiMocks.getVersions,
  uploadContractDocumentVersion: apiMocks.upload,
}));

vi.mock("../documents/DocxPreviewModal", () => ({
  DocxPreviewModal: ({
    isOpen,
    title,
    download,
    error,
    onClose,
    onRetry,
  }: {
    isOpen: boolean;
    title: string;
    download: {
      fileName: string | null;
    } | null;
    error: unknown;
    onClose: () => void;
    onRetry: () => void;
  }) =>
    isOpen ? (
      <section role="dialog" aria-label={title}>
        {download && (
          <span>
            Загружен файл: {download.fileName}
          </span>
        )}
        {Boolean(error) && (
          <span role="alert">
            {error instanceof Error
              ? error.message
              : "Ошибка загрузки"}
          </span>
        )}
        <button type="button" onClick={onRetry}>
          Повторить
        </button>
        <button type="button" onClick={onClose}>
          Закрыть
        </button>
      </section>
    ) : null,
}));

import type {
  Contract,
} from "../../types/contract";
import {
  ContractDocumentTab,
} from "./ContractDocumentTab";

const contract: Contract = {
  id: 7,
  counterparty_id: 3,
  counterparty_name: "ООО Контрагент",
  template_id: 2,
  template_name: "Поставка",
  number: "Д-007",
  title: "Договор поставки",
  contract_date: "2026-07-30",
  start_date: null,
  end_date: null,
  amount: "1000.00",
  currency: "BYN",
  status: "draft",
  archived_at: null,
  is_archived: false,
  notes: null,
  owner_role: "buyer",
  counterparty_role: "supplier",
  form_data: {},
  generated_file_name: "generated.docx",
  created_at: "2026-07-30T08:00:00Z",
  updated_at: "2026-07-30T08:00:00Z",
};

const latestVersion = {
  id: 11,
  contract_id: contract.id,
  version_number: 3,
  source: "generated" as const,
  template_id: 2,
  template_name: "Поставка",
  template_version: 1,
  source_data: {},
  file_name: "contract-v3.docx",
  file_sha256: null,
  file_size_bytes: 2048,
  created_by_user_id: 1,
  created_at: "2026-07-30T08:30:00Z",
};

function renderTab() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <ContractDocumentTab contract={contract} />
      </QueryClientProvider>,
    ),
  };
}

beforeEach(() => {
  apiMocks.getVersions.mockResolvedValue({
    items: [latestVersion],
    total: 1,
    limit: 100,
    offset: 0,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ContractDocumentTab preview", () => {
  it("отключает предпросмотр, пока версии нет", async () => {
    apiMocks.getVersions.mockResolvedValue({
      items: [],
      total: 0,
      limit: 100,
      offset: 0,
    });

    renderTab();

    const previewButton =
      screen.getByRole("button", {
        name: "Предпросмотр",
      });

    await waitFor(() => {
      expect(apiMocks.getVersions).toHaveBeenCalled();
    });
    expect(previewButton).toBeDisabled();
  });

  it("загружает последнюю версию и открывает окно", async () => {
    const download = {
      blob: new Blob(["docx"]),
      fileName: "contract-v3.docx",
    };
    apiMocks.downloadLatest.mockResolvedValue(
      download,
    );
    const { user } = renderTab();

    const previewButton =
      screen.getByRole("button", {
        name: "Предпросмотр",
      });
    await waitFor(() => {
      expect(previewButton).toBeEnabled();
    });
    await user.click(previewButton);

    expect(
      screen.getByRole("dialog", {
        name: "Предпросмотр договора",
      }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        apiMocks.downloadLatest,
      ).toHaveBeenCalledWith(contract.id);
    });
    expect(
      await screen.findByText(
        "Загружен файл: contract-v3.docx",
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Закрыть",
      }),
    );
    expect(
      screen.queryByRole("dialog"),
    ).not.toBeInTheDocument();
  });

  it("повторяет загрузку после ошибки", async () => {
    apiMocks.downloadLatest
      .mockRejectedValueOnce(
        new Error("Нет доступа к документу"),
      )
      .mockResolvedValueOnce({
        blob: new Blob(["docx"]),
        fileName: "contract-v3.docx",
      });
    const { user } = renderTab();

    const previewButton =
      screen.getByRole("button", {
        name: "Предпросмотр",
      });
    await waitFor(() => {
      expect(previewButton).toBeEnabled();
    });
    await user.click(previewButton);

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Нет доступа к документу");

    await user.click(
      screen.getByRole("button", {
        name: "Повторить",
      }),
    );

    expect(
      await screen.findByText(
        "Загружен файл: contract-v3.docx",
      ),
    ).toBeInTheDocument();
    expect(apiMocks.downloadLatest).toHaveBeenCalledTimes(
      2,
    );
  });
});
