import {
  describe,
  expect,
  it,
} from "vitest";

import { formatFileSize } from "./formatters";

describe("formatFileSize", () => {
  it("форматирует байты, килобайты и мегабайты", () => {
    expect(formatFileSize(512)).toBe("512 Б");
    expect(formatFileSize(2048)).toBe("2 КБ");
    expect(formatFileSize(2 * 1024 * 1024)).toBe(
      "2 МБ",
    );
  });

  it("показывает прочерк для неизвестного размера", () => {
    expect(formatFileSize(null)).toBe("—");
  });
});
