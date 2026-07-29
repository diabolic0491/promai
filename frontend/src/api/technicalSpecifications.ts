import {
  apiRequest,
  type ApiDownload,
} from "./client";

import type {
  CreateTechnicalSpecificationPayload,
  TechnicalSpecification,
  TechnicalSpecificationStatus,
  UpdateTechnicalSpecificationPayload,
} from "../types/technicalSpecification";
import type { Page } from "../types/pagination";

export interface TechnicalSpecificationsQuery {
  counterpartyId?: number;
  contractId?: number;
  templateId?: number;
  status?: TechnicalSpecificationStatus;
  search?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export function buildTechnicalSpecificationsQuery(
  query: TechnicalSpecificationsQuery,
): string {
  const parameters = new URLSearchParams();

  if (query.counterpartyId !== undefined) {
    parameters.set(
      "counterparty_id",
      String(query.counterpartyId),
    );
  }

  if (query.contractId !== undefined) {
    parameters.set(
      "contract_id",
      String(query.contractId),
    );
  }

  if (query.templateId !== undefined) {
    parameters.set(
      "template_id",
      String(query.templateId),
    );
  }

  if (query.status) {
    parameters.set(
      "technical_specification_status",
      query.status,
    );
  }

  if (query.search?.trim()) {
    parameters.set("search", query.search.trim());
  }

  if (query.includeArchived) {
    parameters.set("include_archived", "true");
  }

  if (query.limit !== undefined) {
    parameters.set("limit", String(query.limit));
  }

  if (query.offset !== undefined) {
    parameters.set("offset", String(query.offset));
  }

  const queryString = parameters.toString();
  return queryString ? `?${queryString}` : "";
}

export function getTechnicalSpecifications(
  query: TechnicalSpecificationsQuery = {},
): Promise<Page<TechnicalSpecification>> {
  return apiRequest<Page<TechnicalSpecification>>(
    `/technical-specifications${buildTechnicalSpecificationsQuery(
      query,
    )}`,
  );
}

export function getTechnicalSpecification(
  technicalSpecificationId: number,
): Promise<TechnicalSpecification> {
  return apiRequest<TechnicalSpecification>(
    `/technical-specifications/${technicalSpecificationId}`,
  );
}

export function createTechnicalSpecification(
  payload: CreateTechnicalSpecificationPayload,
): Promise<TechnicalSpecification> {
  return apiRequest<TechnicalSpecification>(
    "/technical-specifications",
    {
      method: "POST",
      json: payload,
    },
  );
}

export function updateTechnicalSpecification(
  technicalSpecificationId: number,
  payload: UpdateTechnicalSpecificationPayload,
): Promise<TechnicalSpecification> {
  return apiRequest<TechnicalSpecification>(
    `/technical-specifications/${technicalSpecificationId}`,
    {
      method: "PATCH",
      json: payload,
    },
  );
}

export function archiveTechnicalSpecification(
  technicalSpecificationId: number,
): Promise<TechnicalSpecification> {
  return apiRequest<TechnicalSpecification>(
    `/technical-specifications/${technicalSpecificationId}/archive`,
    { method: "POST" },
  );
}

export function restoreTechnicalSpecification(
  technicalSpecificationId: number,
): Promise<TechnicalSpecification> {
  return apiRequest<TechnicalSpecification>(
    `/technical-specifications/${technicalSpecificationId}/restore`,
    { method: "POST" },
  );
}

export function generateTechnicalSpecification(
  technicalSpecificationId: number,
): Promise<ApiDownload> {
  return apiRequest<ApiDownload>(
    `/technical-specifications/${technicalSpecificationId}/generate`,
    {
      method: "POST",
      responseType: "download",
    },
  );
}

export function downloadTechnicalSpecification(
  technicalSpecificationId: number,
): Promise<ApiDownload> {
  return apiRequest<ApiDownload>(
    `/technical-specifications/${technicalSpecificationId}/download`,
    {
      responseType: "download",
    },
  );
}
