import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  downloadContractDocumentVersion,
  generateContractDocument,
  getContractDocumentVersions,
  uploadContractDocumentVersion,
} from "./contractDocuments";

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

describe("contract documents API", () => {
  it("запрашивает версии с пагинацией и скачивает конкретную версию", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [],
          total: 0,
          limit: 25,
          offset: 50,
        }),
      )
      .mockResolvedValueOnce(
        new Response("docx", {
          headers: {
            "Content-Disposition":
              'attachment; filename="version-3.docx"',
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await getContractDocumentVersions(11, 25, 50);
    const download =
      await downloadContractDocumentVersion(11, 3);

    const versionsUrl = new URL(
      String(fetchMock.mock.calls[0]?.[0]),
    );
    expect(versionsUrl.pathname).toBe(
      "/contracts/11/versions",
    );
    expect(
      Object.fromEntries(versionsUrl.searchParams),
    ).toEqual({
      limit: "25",
      offset: "50",
    });
    expect(
      String(fetchMock.mock.calls[1]?.[0]),
    ).toContain(
      "/contracts/11/versions/3/download",
    );
    expect(download.fileName).toBe("version-3.docx");
  });

  it("генерирует договор POST-запросом как скачиваемый файл", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("docx", {
        headers: {
          "Content-Disposition":
            'attachment; filename="contract.docx"',
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await generateContractDocument(7);

    const [url, options] =
      fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain(
      "/contracts/7/generate",
    );
    expect((options as RequestInit).method).toBe(
      "POST",
    );
  });

  it("загружает DOCX через multipart без ручного Content-Type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 4,
        version_number: 2,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["docx"], "contract.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    await uploadContractDocumentVersion(5, file);

    const [url, options] =
      fetchMock.mock.calls[0] ?? [];
    const requestOptions = options as RequestInit;
    const headers = new Headers(
      requestOptions.headers,
    );
    const body = requestOptions.body as FormData;

    expect(String(url)).toContain(
      "/contracts/5/versions/upload",
    );
    expect(requestOptions.method).toBe("POST");
    expect(headers.has("Content-Type")).toBe(false);
    expect(body.get("file")).toBe(file);
  });
});
