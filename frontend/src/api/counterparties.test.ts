import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  createCounterparty,
  getCounterparties,
} from "./counterparties";

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("counterparties API", () => {
  it("передаёт поиск, архив и пагинацию query-параметрами", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [],
        total: 0,
        limit: 20,
        offset: 40,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getCounterparties({
      search: " 190000001 ",
      includeArchived: true,
      limit: 20,
      offset: 40,
    });

    const requestUrl = new URL(
      String(fetchMock.mock.calls[0]?.[0]),
    );

    expect(requestUrl.pathname).toBe(
      "/counterparties",
    );
    expect(
      Object.fromEntries(requestUrl.searchParams),
    ).toEqual({
      search: "190000001",
      include_archived: "true",
      limit: "20",
      offset: "40",
    });
    expect(result).toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 40,
    });
  });

  it("создаёт контрагента JSON-запросом", async () => {
    const created = {
      id: 7,
      unp: "190000001",
      name: "ООО «Тест»",
      short_name: null,
      legal_address: null,
      status: "active",
      created_at: "2026-07-29T08:00:00Z",
      updated_at: "2026-07-29T08:00:00Z",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(created, 201));
    vi.stubGlobal("fetch", fetchMock);

    await createCounterparty({
      unp: "190000001",
      name: "ООО «Тест»",
      short_name: null,
      legal_address: null,
    });

    const requestOptions = fetchMock.mock
      .calls[0]?.[1] as RequestInit;

    expect(requestOptions.method).toBe("POST");
    expect(
      new Headers(requestOptions.headers).get(
        "Content-Type",
      ),
    ).toBe("application/json");
    expect(JSON.parse(String(requestOptions.body))).toEqual({
      unp: "190000001",
      name: "ООО «Тест»",
      short_name: null,
      legal_address: null,
    });
  });
});
