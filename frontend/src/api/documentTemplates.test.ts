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
  downloadDocumentTemplate,
  getDocumentTemplates,
  restoreDocumentTemplate,
  updateDocumentTemplate,
} from "./documentTemplates";

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

describe("document templates API", () => {
  it("передаёт тип, поиск, архив и пагинацию", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [],
        total: 0,
        limit: 20,
        offset: 20,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getDocumentTemplates({
      templateType: "contract",
      search: " Договор ",
      includeArchived: true,
      limit: 20,
      offset: 20,
    });

    const requestUrl = new URL(
      String(fetchMock.mock.calls[0]?.[0]),
    );

    expect(requestUrl.pathname).toBe(
      "/document-templates",
    );
    expect(
      Object.fromEntries(requestUrl.searchParams),
    ).toEqual({
      template_type: "contract",
      search: "Договор",
      include_archived: "true",
      limit: "20",
      offset: "20",
    });
  });

  it("создаёт шаблон multipart-запросом", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: 7 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(
      ["docx"],
      "contract.docx",
      {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    );

    await createDocumentTemplate({
      name: "Договор поставки",
      template_type: "contract",
      description: "Основной шаблон",
      required_variables: [
        "contract.number",
        "organization.name",
      ],
      file,
    });

    const requestOptions = fetchMock.mock
      .calls[0]?.[1] as RequestInit;
    const body = requestOptions.body as FormData;

    expect(requestOptions.method).toBe("POST");
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("name")).toBe(
      "Договор поставки",
    );
    expect(body.get("template_type")).toBe(
      "contract",
    );
    expect(body.get("description")).toBe(
      "Основной шаблон",
    );
    expect(body.get("required_variables")).toBe(
      JSON.stringify([
        "contract.number",
        "organization.name",
      ]),
    );
    expect(body.get("file")).toBe(file);
  });

  it("обновляет только метаданные шаблона", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: 9 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await updateDocumentTemplate(9, {
      name: "Новая редакция",
      description: null,
      is_active: false,
    });

    const [url, options] =
      fetchMock.mock.calls[0] ?? [];

    expect(String(url)).toContain(
      "/document-templates/9",
    );
    expect((options as RequestInit).method).toBe(
      "PATCH",
    );
    expect(
      JSON.parse(
        String((options as RequestInit).body),
      ),
    ).toEqual({
      name: "Новая редакция",
      description: null,
      is_active: false,
    });
  });

  it("архивирует и восстанавливает POST-запросами", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () =>
        jsonResponse({ id: 4 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await archiveDocumentTemplate(4);
    await restoreDocumentTemplate(4);

    const [archiveUrl, archiveOptions] =
      fetchMock.mock.calls[0] ?? [];
    const [restoreUrl, restoreOptions] =
      fetchMock.mock.calls[1] ?? [];

    expect(
      String(archiveUrl),
    ).toContain(
      "/document-templates/4/archive",
    );
    expect(
      (archiveOptions as RequestInit).method,
    ).toBe("POST");
    expect(
      String(restoreUrl),
    ).toContain(
      "/document-templates/4/restore",
    );
    expect(
      (restoreOptions as RequestInit).method,
    ).toBe("POST");
  });

  it("скачивает исходный DOCX с именем сервера", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("docx", {
        headers: {
          "Content-Disposition":
            'attachment; filename="contract.docx"',
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const download =
      await downloadDocumentTemplate(3);

    expect(download.fileName).toBe("contract.docx");
    expect(download.blob.size).toBe(4);
    expect(await download.blob.text()).toBe("docx");
    expect(
      String(fetchMock.mock.calls[0]?.[0]),
    ).toContain(
      "/document-templates/3/download",
    );
  });
});
