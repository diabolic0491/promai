import { apiRequest } from "./client";

import type {
  DocumentTemplate,
  DocumentTemplateType,
} from "../types/documentTemplate";
import type { Page } from "../types/pagination";

export interface DocumentTemplatesQuery {
  templateType?: DocumentTemplateType;
  search?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export function getDocumentTemplates(
  query: DocumentTemplatesQuery = {},
): Promise<Page<DocumentTemplate>> {
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

  return apiRequest<Page<DocumentTemplate>>(
    `/document-templates${
      queryString ? `?${queryString}` : ""
    }`,
  );
}
