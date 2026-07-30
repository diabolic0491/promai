import { QueryClientProvider } from
  "@tanstack/react-query";
import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RouterProvider,
  createMemoryRouter,
} from "react-router-dom";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  archiveDocumentTemplate,
  createDocumentTemplate,
  getDocumentTemplates,
} from "../api/documentTemplates";
import { queryClient } from
  "../app/queryClient";
import type {
  CurrentUser,
  UserRole,
} from "../features/auth/auth.types";
import {
  AuthContext,
  type AuthContextValue,
} from "../features/auth/authContext";
import type {
  DocumentTemplate,
} from "../types/documentTemplate";
import { TemplatesPage } from "./TemplatesPage";

vi.mock("../api/documentTemplates", () => ({
  archiveDocumentTemplate: vi.fn(),
  createDocumentTemplate: vi.fn(),
  downloadDocumentTemplate: vi.fn(),
  getDocumentTemplates: vi.fn(),
  restoreDocumentTemplate: vi.fn(),
  updateDocumentTemplate: vi.fn(),
}));

const activeTemplate: DocumentTemplate = {
  id: 4,
  name: "Договор поставки",
  template_type: "contract",
  description: "Основной шаблон",
  file_name: "contract.docx",
  version: 1,
  required_variables: ["contract.number"],
  is_active: true,
  archived_at: null,
  is_archived: false,
  created_at: "2026-07-28T08:00:00Z",
  updated_at: "2026-07-29T08:00:00Z",
};

function createUser(role: UserRole): CurrentUser {
  return {
    id: role === "admin" ? 1 : 2,
    username: role,
    full_name:
      role === "admin"
        ? "Администратор"
        : "Менеджер",
    role,
    is_active: true,
    last_login_at: null,
    created_at: "2026-07-28T08:00:00Z",
    updated_at: "2026-07-29T08:00:00Z",
  };
}

function renderPage(role: UserRole) {
  const authValue: AuthContextValue = {
    status: "authenticated",
    user: createUser(role),
    login: async () => undefined,
    logout: async () => undefined,
  };
  const router = createMemoryRouter(
    [
      {
        path: "/templates",
        element: <TemplatesPage />,
      },
    ],
    { initialEntries: ["/templates"] },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

function mockTemplatePage(
  templates: DocumentTemplate[] = [
    activeTemplate,
  ],
) {
  vi.mocked(getDocumentTemplates).mockResolvedValue({
    items: templates,
    total: templates.length,
    limit: 20,
    offset: 0,
  });
}

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.clearAllMocks();
});

describe("TemplatesPage", () => {
  it("показывает Manager только рабочие действия", async () => {
    mockTemplatePage();

    renderPage("manager");

    expect(
      await screen.findByText("Договор поставки"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Рабочие шаблоны"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Скачать шаблон Договор поставки",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Загрузить шаблон",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", {
        name: "Показывать архив",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Редактировать шаблон Договор поставки",
      }),
    ).not.toBeInTheDocument();

    expect(getDocumentTemplates).toHaveBeenCalledWith(
      expect.objectContaining({
        includeArchived: false,
      }),
    );
  });

  it("создаёт DOCX-шаблон из формы Admin", async () => {
    const user = userEvent.setup();
    mockTemplatePage([]);
    vi.mocked(
      createDocumentTemplate,
    ).mockResolvedValue(activeTemplate);

    renderPage("admin");

    const uploadButtons =
      await screen.findAllByRole("button", {
        name: "Загрузить шаблон",
      });
    await user.click(uploadButtons[0]!);
    await user.type(
      screen.getByRole("textbox", {
        name: /Название/,
      }),
      "Договор поставки",
    );
    await user.type(
      screen.getByRole("textbox", {
        name: "Имя переменной",
      }),
      "contract.number",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Добавить",
      }),
    );

    const file = new File(
      ["docx"],
      "contract.docx",
      {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    );
    await user.upload(
      screen.getByLabelText(/Файл DOCX/),
      file,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Создать шаблон",
      }),
    );

    await waitFor(() => {
      expect(
        createDocumentTemplate,
      ).toHaveBeenCalledWith({
        name: "Договор поставки",
        template_type: "contract",
        description: null,
        required_variables: [
          "contract.number",
        ],
        file,
      });
    });
    expect(
      await screen.findByText(
        "Шаблон «Договор поставки» создан",
      ),
    ).toBeInTheDocument();
  });

  it("передаёт Admin архивный фильтр", async () => {
    const user = userEvent.setup();
    mockTemplatePage();

    renderPage("admin");

    await screen.findByText("Договор поставки");
    await user.click(
      screen.getByRole("checkbox", {
        name: "Показывать архив",
      }),
    );

    await waitFor(() => {
      expect(
        getDocumentTemplates,
      ).toHaveBeenLastCalledWith(
        expect.objectContaining({
          includeArchived: true,
        }),
      );
    });
  });

  it("архивирует шаблон после подтверждения", async () => {
    const user = userEvent.setup();
    mockTemplatePage();
    vi.mocked(
      archiveDocumentTemplate,
    ).mockResolvedValue({
      ...activeTemplate,
      is_active: false,
      is_archived: true,
      archived_at: "2026-07-29T10:00:00Z",
    });

    renderPage("admin");

    await user.click(
      await screen.findByRole("button", {
        name: "Архивировать шаблон Договор поставки",
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Архивировать",
      }),
    );

    await waitFor(() => {
      expect(
        archiveDocumentTemplate,
      ).toHaveBeenCalledWith(activeTemplate.id);
    });
    expect(
      await screen.findByText(
        "Шаблон «Договор поставки» перемещён в архив",
      ),
    ).toBeInTheDocument();
  });
});
