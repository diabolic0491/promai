import { QueryClientProvider } from
  "@tanstack/react-query";
import {
  render,
  screen,
} from "@testing-library/react";
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import { queryClient } from "../../app/queryClient";
import { AuthProvider } from "./AuthContext";
import { RequireAuth } from "./RequireAuth";
import { RequireRole } from "./RequireRole";
import {
  AuthContext,
  type AuthContextValue,
} from "./authContext";

afterEach(() => {
  window.sessionStorage.clear();
  queryClient.clear();
});

describe("маршрутные ограничения", () => {
  it("перенаправляет гостя с защищённого маршрута на login", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/private"]}>
            <Routes>
              <Route element={<RequireAuth />}>
                <Route
                  path="/private"
                  element={<div>Закрытый раздел</div>}
                />
              </Route>
              <Route
                path="/login"
                element={<div>Страница входа</div>}
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("Страница входа"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Закрытый раздел"),
    ).not.toBeInTheDocument();
  });

  it("не пропускает Manager на Admin-маршрут", async () => {
    const authValue: AuthContextValue = {
      status: "authenticated",
      user: {
        id: 2,
        username: "manager",
        full_name: "Менеджер",
        role: "manager",
        is_active: true,
        last_login_at: null,
        created_at: "2026-07-28T00:00:00Z",
        updated_at: "2026-07-28T00:00:00Z",
      },
      login: async () => undefined,
      logout: async () => undefined,
    };

    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter
          initialEntries={["/administration/users"]}
        >
          <Routes>
            <Route
              element={
                <RequireRole allowed={["admin"]} />
              }
            >
              <Route
                path="/administration/users"
                element={<Outlet />}
              >
                <Route
                  index
                  element={
                    <div>Пользователи Admin</div>
                  }
                />
              </Route>
            </Route>
            <Route
              path="/forbidden"
              element={<div>Нет доступа</div>}
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(
      await screen.findByText("Нет доступа"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Пользователи Admin"),
    ).not.toBeInTheDocument();
  });
});
