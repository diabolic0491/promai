import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  createUser,
  getUsers,
  updateUser,
} from "./users";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("users API", () => {
  it("передаёт поиск, роль, active и пагинацию", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [],
        total: 0,
        limit: 20,
        offset: 20,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getUsers({
      search: " Павел ",
      role: "admin",
      isActive: false,
      limit: 20,
      offset: 20,
    });

    const requestUrl = new URL(
      String(fetchMock.mock.calls[0]?.[0]),
    );

    expect(requestUrl.pathname).toBe("/users");
    expect(
      Object.fromEntries(requestUrl.searchParams),
    ).toEqual({
      role: "admin",
      is_active: "false",
      search: "Павел",
      limit: "20",
      offset: "20",
    });
  });

  it("создаёт пользователя полным POST payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: 7 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createUser({
      username: "manager",
      full_name: "Новый менеджер",
      password: "long-password",
      role: "manager",
      is_active: true,
    });

    const requestOptions = fetchMock.mock
      .calls[0]?.[1] as RequestInit;

    expect(requestOptions.method).toBe("POST");
    expect(
      JSON.parse(String(requestOptions.body)),
    ).toEqual({
      username: "manager",
      full_name: "Новый менеджер",
      password: "long-password",
      role: "manager",
      is_active: true,
    });
  });

  it("обновляет пользователя без обязательной передачи пароля", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: 9 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await updateUser(9, {
      full_name: "Администратор",
      role: "admin",
      is_active: true,
    });

    const [url, options] =
      fetchMock.mock.calls[0] ?? [];

    expect(String(url)).toContain("/users/9");
    expect((options as RequestInit).method).toBe(
      "PATCH",
    );
    expect(
      JSON.parse(
        String((options as RequestInit).body),
      ),
    ).not.toHaveProperty("password");
  });
});
