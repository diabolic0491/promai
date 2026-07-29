import type {
  ApiDownload,
} from "../api/client";

export function saveDownload(
  download: ApiDownload,
  fallbackFileName: string,
): void {
  const objectUrl = URL.createObjectURL(download.blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download =
    download.fileName || fallbackFileName;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
