import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  apiRequest,
  getDownloadFileName,
} from "./client";
import {
  clearTokens,
  setTokens,
} from "../features/auth/tokenStore";

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
  clearTokens();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("apiRequest", () => {
  it("обрабатывает 204 без попытки прочитать JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, {
        status: 204,
      }));

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiRequest<void>("/auth/logout", {
        method: "POST",
        responseType: "void",
      }),
    ).resolves.toBeUndefined();
  });

  it("не задаёт Content-Type для FormData", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, {
        status: 204,
      }));

    vi.stubGlobal("fetch", fetchMock);

    const formData = new FormData();
    formData.append("file", new Blob(["docx"]));

    await apiRequest<void>("/upload", {
      method: "POST",
      body: formData,
      responseType: "void",
    });

    const requestOptions = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(requestOptions?.headers);

    expect(headers.has("Content-Type")).toBe(false);
  });

  it("возвращает blob для скачивания файла", async () => {
    const documentBody = "document";
    const documentType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(documentBody, {
          status: 200,
          headers: {
            "Content-Type": documentType,
          },
        }),
      ),
    );

    const result = await apiRequest<Blob>(
      "/contracts/1/download",
      {
        responseType: "blob",
      },
    );

    expect(result.type).toBe(documentType);
    expect(result.size).toBe(
      new TextEncoder().encode(documentBody).byteLength,
    );
  });

  it("возвращает blob и UTF-8 имя файла из Content-Disposition", async () => {
    const fileName =
      "%D0%94%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80.docx";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("document", {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition":
              `attachment; filename*=UTF-8''${fileName}`,
          },
        }),
      ),
    );

    const result = await apiRequest<{
      blob: Blob;
      fileName: string | null;
    }>("/contracts/1/download", {
      responseType: "download",
    });

    expect(result.fileName).toBe("Договор.docx");
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it("понимает обычное имя файла в Content-Disposition", () => {
    const response = new Response(null, {
      headers: {
        "Content-Disposition":
          'attachment; filename="contract.docx"',
      },
    });

    expect(getDownloadFileName(response)).toBe(
      "contract.docx",
    );
  });

  it("передаёт понятный detail из ошибки backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { detail: "Контрагент уже существует" },
          409,
        ),
      ),
    );

    await expect(
      apiRequest("/counterparties"),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 409,
        message: "Контрагент уже существует",
      }),
    );
  });

  it("передаёт message из объектного detail backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            detail: {
              message:
                "Не заполнены обязательные переменные шаблона",
              missing_variables: ["contract.subject"],
            },
          },
          422,
        ),
      ),
    );

    await expect(
      apiRequest("/contracts/1/generate"),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 422,
        message:
          "Не заполнены обязательные переменные шаблона",
      }),
    );
  });

  it("выполняет один refresh для параллельных 401", async () => {
    setTokens({
      access_token: "expired-access",
      refresh_token: "valid-refresh",
      token_type: "bearer",
      access_expires_in: 900,
    });

    let refreshCalls = 0;

    const fetchMock = vi.fn(
      async (
        input: string | URL | Request,
        init?: RequestInit,
      ) => {
        const url = String(input);

        if (url.endsWith("/auth/refresh")) {
          refreshCalls += 1;
          await new Promise((resolve) => {
            setTimeout(resolve, 1);
          });

          return jsonResponse({
            access_token: "fresh-access",
            refresh_token: "fresh-refresh",
            token_type: "bearer",
            access_expires_in: 900,
          });
        }

        const authorization = new Headers(
          init?.headers,
        ).get("Authorization");

        if (
          authorization === "Bearer expired-access"
        ) {
          return jsonResponse(
            { detail: "Требуется аутентификация" },
            401,
          );
        }

        return jsonResponse({
          path: new URL(url).pathname,
        });
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    const [contracts, counterparties] =
      await Promise.all([
        apiRequest<{ path: string }>("/contracts"),
        apiRequest<{ path: string }>(
          "/counterparties",
        ),
      ]);

    expect(refreshCalls).toBe(1);
    expect(contracts.path).toBe("/contracts");
    expect(counterparties.path).toBe(
      "/counterparties",
    );
  });
});
