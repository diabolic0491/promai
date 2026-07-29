import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  getContractAnalysisRun,
  getContractAnalysisRuns,
  startContractAnalysis,
} from "./contractAnalysis";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("contract analysis API", () => {
  it("использует маршруты выбранной версии для истории и polling", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [],
          total: 0,
          limit: 10,
          offset: 20,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 31,
          status: "running",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await getContractAnalysisRuns(8, 4, 10, 20);
    await getContractAnalysisRun(8, 4, 31);

    const listUrl = new URL(
      String(fetchMock.mock.calls[0]?.[0]),
    );
    expect(listUrl.pathname).toBe(
      "/contracts/8/versions/4/analyses",
    );
    expect(
      Object.fromEntries(listUrl.searchParams),
    ).toEqual({
      limit: "10",
      offset: "20",
    });
    expect(
      String(fetchMock.mock.calls[1]?.[0]),
    ).toContain(
      "/contracts/8/versions/4/analyses/31",
    );
  });

  it("запускает анализ выбранной версии POST-запросом", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 12,
        status: "completed",
        findings: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await startContractAnalysis(2, 6);

    const [url, options] =
      fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain(
      "/contracts/2/versions/6/analyses",
    );
    expect((options as RequestInit).method).toBe(
      "POST",
    );
  });
});
