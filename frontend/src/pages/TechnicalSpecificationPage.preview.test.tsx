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
  createMemoryRouter,
  RouterProvider,
} from "react-router-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const apiMocks = vi.hoisted(() => ({
  archive: vi.fn(),
  download: vi.fn(),
  generate: vi.fn(),
  get: vi.fn(),
  restore: vi.fn(),
}));

vi.mock("../api/technicalSpecifications", () => ({
  archiveTechnicalSpecification: apiMocks.archive,
  downloadTechnicalSpecification:
    apiMocks.download,
  generateTechnicalSpecification:
    apiMocks.generate,
  getTechnicalSpecification: apiMocks.get,
  restoreTechnicalSpecification: apiMocks.restore,
}));

vi.mock("../components/documents/DocxPreviewModal", () => ({
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
  TechnicalSpecification,
} from "../types/technicalSpecification";
import {
  TechnicalSpecificationPage,
} from "./TechnicalSpecificationPage";

const technicalSpecification: TechnicalSpecification = {
  id: 17,
  counterparty_id: 3,
  counterparty_name: "ООО Контрагент",
  contract_id: null,
  contract_number: null,
  template_id: 4,
  template_name: "Закупка оборудования",
  title: "ТЗ на закупку оборудования",
  procurement_subject: "Серверное оборудование",
  procurement_procedure: "Запрос ценовых предложений",
  legal_basis: "Законодательство Республики Беларусь",
  internal_regulation_document: "Положение о закупках",
  approval_date: "2026-07-30",
  work_start_date: "2026-08-01",
  work_end_date: "2026-08-31",
  status: "draft",
  form_data: {},
  generated_file_name: "technical-specification-17.docx",
  archived_at: null,
  is_archived: false,
  created_at: "2026-07-30T08:00:00Z",
  updated_at: "2026-07-30T08:30:00Z",
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const router = createMemoryRouter(
    [
      {
        path: "/technical-specifications/:id",
        element: (
          <QueryClientProvider client={queryClient}>
            <TechnicalSpecificationPage />
          </QueryClientProvider>
        ),
      },
    ],
    {
      initialEntries: [
        `/technical-specifications/${technicalSpecification.id}`,
      ],
    },
  );

  return {
    user: userEvent.setup(),
    ...render(<RouterProvider router={router} />),
  };
}

beforeEach(() => {
  apiMocks.get.mockResolvedValue(
    technicalSpecification,
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TechnicalSpecificationPage preview", () => {
  it("не показывает предпросмотр, пока DOCX не сформирован", async () => {
    apiMocks.get.mockResolvedValue({
      ...technicalSpecification,
      generated_file_name: null,
    });

    renderPage();

    await screen.findByRole("heading", {
      name: technicalSpecification.title,
    });

    expect(
      screen.queryByRole("button", {
        name: "Предпросмотр",
      }),
    ).not.toBeInTheDocument();
  });

  it("загружает сформированный DOCX и открывает предпросмотр", async () => {
    apiMocks.download.mockResolvedValue({
      blob: new Blob(["docx"]),
      fileName: "technical-specification-17.docx",
    });
    const { user } = renderPage();

    await user.click(
      await screen.findByRole("button", {
        name: "Предпросмотр",
      }),
    );

    expect(
      await screen.findByRole("dialog", {
        name: "Предпросмотр технического задания",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Загружен файл: technical-specification-17.docx",
      ),
    ).toBeInTheDocument();
    expect(apiMocks.download).toHaveBeenCalledWith(
      technicalSpecification.id,
    );
  });

  it("повторяет загрузку после ошибки", async () => {
    apiMocks.download
      .mockRejectedValueOnce(
        new Error("Не удалось загрузить ТЗ"),
      )
      .mockResolvedValueOnce({
        blob: new Blob(["docx"]),
        fileName: "technical-specification-17.docx",
      });
    const { user } = renderPage();

    await user.click(
      await screen.findByRole("button", {
        name: "Предпросмотр",
      }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Не удалось загрузить ТЗ");

    await user.click(
      screen.getByRole("button", {
        name: "Повторить",
      }),
    );

    await waitFor(() => {
      expect(apiMocks.download).toHaveBeenCalledTimes(2);
    });
    expect(
      await screen.findByText(
        "Загружен файл: technical-specification-17.docx",
      ),
    ).toBeInTheDocument();
  });
});
