import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  getContractEvents,
  getContractStatusHistory,
  getContracts,
  updateContractStatus,
} from "./contracts";

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

describe("contracts API", () => {
  it("передаёт все фильтры и пагинацию точными query-параметрами", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [],
        total: 0,
        limit: 20,
        offset: 20,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getContracts({
      counterpartyId: 17,
      status: "pending_approval",
      search: " Д-101 ",
      includeArchived: true,
      limit: 20,
      offset: 20,
    });

    const requestUrl = new URL(
      String(fetchMock.mock.calls[0]?.[0]),
    );

    expect(requestUrl.pathname).toBe("/contracts");
    expect(
      Object.fromEntries(requestUrl.searchParams),
    ).toEqual({
      counterparty_id: "17",
      status: "pending_approval",
      search: "Д-101",
      include_archived: "true",
      limit: "20",
      offset: "20",
    });
  });

  it("меняет статус PATCH-запросом с отдельным status payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 5,
        status: "pending_approval",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await updateContractStatus(
      5,
      "pending_approval",
    );

    const [url, options] =
      fetchMock.mock.calls[0] ?? [];
    const requestOptions = options as RequestInit;

    expect(String(url)).toContain(
      "/contracts/5/status",
    );
    expect(requestOptions.method).toBe("PATCH");
    expect(JSON.parse(String(requestOptions.body))).toEqual(
      {
        status: "pending_approval",
      },
    );
  });

  it("запрашивает историю и события отдельными маршрутами", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await getContractStatusHistory(9);
    await getContractEvents(9);

    expect(
      String(fetchMock.mock.calls[0]?.[0]),
    ).toContain("/contracts/9/status-history");
    expect(
      String(fetchMock.mock.calls[1]?.[0]),
    ).toContain("/contracts/9/events");
  });
});
