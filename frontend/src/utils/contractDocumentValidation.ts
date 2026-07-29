export const MAX_CONTRACT_DOCX_SIZE =
  10 * 1024 * 1024;

export function validateContractDocumentFile(
  file: File,
): string | null {
  if (!file.name.toLowerCase().endsWith(".docx")) {
    return "Выберите файл в формате DOCX";
  }

  if (file.size > MAX_CONTRACT_DOCX_SIZE) {
    return "Размер документа не должен превышать 10 МБ";
  }

  return null;
}
