import {
  describe,
  expect,
  it,
} from "vitest";

import {
  MAX_CONTRACT_DOCX_SIZE,
  validateContractDocumentFile,
} from "../../utils/contractDocumentValidation";

describe("contract DOCX validation", () => {
  it("принимает DOCX не больше 10 МБ", () => {
    const file = new File(
      [new Uint8Array(128)],
      "Договор.DOCX",
    );

    expect(
      validateContractDocumentFile(file),
    ).toBeNull();
  });

  it("отклоняет другой формат", () => {
    const file = new File(["pdf"], "contract.pdf");

    expect(
      validateContractDocumentFile(file),
    ).toBe("Выберите файл в формате DOCX");
  });

  it("отклоняет DOCX больше 10 МБ", () => {
    const file = {
      name: "contract.docx",
      size: MAX_CONTRACT_DOCX_SIZE + 1,
    } as File;

    expect(
      validateContractDocumentFile(file),
    ).toBe(
      "Размер документа не должен превышать 10 МБ",
    );
  });
});
