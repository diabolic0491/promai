import { QueryClientProvider } from
  "@tanstack/react-query";
import {
  render,
  screen,
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
  getOrganizationProfile,
  updateOrganizationProfile,
} from "../api/organizationProfile";
import { queryClient } from "../app/queryClient";
import type {
  CurrentUser,
  UserRole,
} from "../features/auth/auth.types";
import {
  AuthContext,
  type AuthContextValue,
} from "../features/auth/authContext";
import type {
  OrganizationProfile,
} from "../types/organizationProfile";
import { OrganizationPage } from "./OrganizationPage";

vi.mock("../api/organizationProfile", () => ({
  getOrganizationProfile: vi.fn(),
  updateOrganizationProfile: vi.fn(),
}));

const profile: OrganizationProfile = {
  id: 1,
  name: "ООО «Промас Инжиниринг»",
  short_name: "ООО «Промас»",
  unp: "190000001",
  legal_address: "г. Минск",
  email: "info@example.by",
  phone: "+375 29 000-00-00",
  director_name: "Иванов Иван Иванович",
  director_position: "Директор",
  bank_name: "ОАО Банк",
  bank_account: "BY00TEST00000000000000000000",
  bank_code: "TESTBY2X",
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
        path: "/organization",
        element: <OrganizationPage />,
      },
    ],
    { initialEntries: ["/organization"] },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
});

describe("OrganizationPage", () => {
  it("показывает Manager только режим просмотра", async () => {
    vi.mocked(getOrganizationProfile).mockResolvedValue(
      profile,
    );

    renderPage("manager");

    expect(
      await screen.findByText("Режим просмотра"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Редактировать",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox"),
    ).not.toBeInTheDocument();
  });

  it("передаёт Admin все изменённые реквизиты", async () => {
    const user = userEvent.setup();
    vi.mocked(getOrganizationProfile).mockResolvedValue(
      profile,
    );
    vi.mocked(
      updateOrganizationProfile,
    ).mockImplementation(async (payload) => ({
      ...profile,
      director_position:
        payload.director_position ?? null,
    }));

    renderPage("admin");

    await user.click(
      await screen.findByRole("button", {
        name: "Редактировать",
      }),
    );

    const positionInput = screen.getByRole("textbox", {
      name: "Должность руководителя",
    });
    await user.clear(positionInput);
    await user.type(
      positionInput,
      "Генеральный директор",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Сохранить",
      }),
    );

    expect(
      updateOrganizationProfile,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        name: profile.name,
        short_name: profile.short_name,
        director_position:
          "Генеральный директор",
      }),
    );
    expect(
      await screen.findByText("Реквизиты сохранены"),
    ).toBeInTheDocument();
  });
});
