import {
  apiRequest,
  type ApiDownload,
} from "./client";

import type {
  ContractDocumentVersion,
} from "../types/contractDocument";
import type { Page } from "../types/pagination";

export function getContractDocumentVersions(
  contractId: number,
  limit = 100,
  offset = 0,
): Promise<Page<ContractDocumentVersion>> {
  const parameters = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return apiRequest<Page<ContractDocumentVersion>>(
    `/contracts/${contractId}/versions?${parameters.toString()}`,
  );
}

export function generateContractDocument(
  contractId: number,
): Promise<ApiDownload> {
  return apiRequest<ApiDownload>(
    `/contracts/${contractId}/generate`,
    {
      method: "POST",
      responseType: "download",
    },
  );
}

export function downloadLatestContractDocument(
  contractId: number,
): Promise<ApiDownload> {
  return apiRequest<ApiDownload>(
    `/contracts/${contractId}/download`,
    { responseType: "download" },
  );
}

export function uploadContractDocumentVersion(
  contractId: number,
  file: File,
): Promise<ContractDocumentVersion> {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest<ContractDocumentVersion>(
    `/contracts/${contractId}/versions/upload`,
    {
      method: "POST",
      body: formData,
    },
  );
}

export function downloadContractDocumentVersion(
  contractId: number,
  versionNumber: number,
): Promise<ApiDownload> {
  return apiRequest<ApiDownload>(
    `/contracts/${contractId}/versions/${versionNumber}/download`,
    { responseType: "download" },
  );
}
