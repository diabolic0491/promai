import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  generateTechnicalSpecification,
  getTechnicalSpecifications,
  updateTechnicalSpecification,
} from "./technicalSpecifications";

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

describe("technical specifications API", () => {
  it("передаёт все фильтры с точными именами backend-параметров", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [],
        total: 0,
        limit: 20,
        offset: 40,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getTechnicalSpecifications({
      counterpartyId: 7,
      contractId: 15,
      templateId: 3,
      status: "pending_approval",
      search: " Закупка ",
      includeArchived: true,
      limit: 20,
      offset: 40,
    });

    const requestUrl = new URL(
      String(fetchMock.mock.calls[0]?.[0]),
    );

    expect(requestUrl.pathname).toBe(
      "/technical-specifications",
    );
    expect(
      Object.fromEntries(requestUrl.searchParams),
    ).toEqual({
      counterparty_id: "7",
      contract_id: "15",
      template_id: "3",
      technical_specification_status:
        "pending_approval",
      search: "Закупка",
      include_archived: "true",
      limit: "20",
      offset: "40",
    });
  });

  it("отправляет PATCH с вложенным form_data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: 4 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await updateTechnicalSpecification(4, {
      title: "ТЗ на оборудование",
      form_data: {
        tz: {
          delivery_address: "г. Минск",
        },
      },
    });

    const [url, options] =
      fetchMock.mock.calls[0] ?? [];
    const requestOptions = options as RequestInit;

    expect(String(url)).toContain(
      "/technical-specifications/4",
    );
    expect(requestOptions.method).toBe("PATCH");
    expect(
      JSON.parse(String(requestOptions.body)),
    ).toEqual({
      title: "ТЗ на оборудование",
      form_data: {
        tz: {
          delivery_address: "г. Минск",
        },
      },
    });
  });

  it("генерирует DOCX POST-запросом и возвращает имя файла", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("docx", {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition":
            'attachment; filename="specification.docx"',
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result =
      await generateTechnicalSpecification(8);
    const [, options] =
      fetchMock.mock.calls[0] ?? [];

    expect(
      String(fetchMock.mock.calls[0]?.[0]),
    ).toContain(
      "/technical-specifications/8/generate",
    );
    expect(
      (options as RequestInit).method,
    ).toBe("POST");
    expect(result.fileName).toBe(
      "specification.docx",
    );
  });
});
