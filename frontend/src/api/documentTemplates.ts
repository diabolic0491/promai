import {
  apiRequest,
  type ApiDownload,
} from "./client";

import type {
  CreateDocumentTemplatePayload,
  DocumentTemplate,
  DocumentTemplateType,
  UpdateDocumentTemplatePayload,
} from "../types/documentTemplate";
import type { Page } from "../types/pagination";

export interface DocumentTemplatesQuery {
  templateType?: DocumentTemplateType;
  search?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export function buildDocumentTemplatesQuery(
  query: DocumentTemplatesQuery,
): string {
  const parameters = new URLSearchParams();

  if (query.templateType) {
    parameters.set(
      "template_type",
      query.templateType,
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

export function getDocumentTemplates(
  query: DocumentTemplatesQuery = {},
): Promise<Page<DocumentTemplate>> {
  return apiRequest<Page<DocumentTemplate>>(
    `/document-templates${buildDocumentTemplatesQuery(
      query,
    )}`,
  );
}

export function getDocumentTemplate(
  templateId: number,
): Promise<DocumentTemplate> {
  return apiRequest<DocumentTemplate>(
    `/document-templates/${templateId}`,
  );
}

export function createDocumentTemplate(
  payload: CreateDocumentTemplatePayload,
): Promise<DocumentTemplate> {
  const formData = new FormData();

  formData.set("name", payload.name);
  formData.set(
    "template_type",
    payload.template_type,
  );
  formData.set(
    "required_variables",
    JSON.stringify(payload.required_variables),
  );
  formData.set("file", payload.file);

  if (payload.description) {
    formData.set("description", payload.description);
  }

  return apiRequest<DocumentTemplate>(
    "/document-templates",
    {
      method: "POST",
      body: formData,
    },
  );
}

export function updateDocumentTemplate(
  templateId: number,
  payload: UpdateDocumentTemplatePayload,
): Promise<DocumentTemplate> {
  return apiRequest<DocumentTemplate>(
    `/document-templates/${templateId}`,
    {
      method: "PATCH",
      json: payload,
    },
  );
}

export function downloadDocumentTemplate(
  templateId: number,
): Promise<ApiDownload> {
  return apiRequest<ApiDownload>(
    `/document-templates/${templateId}/download`,
    {
      responseType: "download",
    },
  );
}

export function archiveDocumentTemplate(
  templateId: number,
): Promise<DocumentTemplate> {
  return apiRequest<DocumentTemplate>(
    `/document-templates/${templateId}/archive`,
    {
      method: "POST",
    },
  );
}

export function restoreDocumentTemplate(
  templateId: number,
): Promise<DocumentTemplate> {
  return apiRequest<DocumentTemplate>(
    `/document-templates/${templateId}/restore`,
    {
      method: "POST",
    },
  );
}
