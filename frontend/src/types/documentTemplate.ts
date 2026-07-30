export type DocumentTemplateType =
  | "contract"
  | "technical_specification";

export interface DocumentTemplate {
  id: number;
  name: string;
  template_type: DocumentTemplateType;
  description: string | null;
  file_name: string;
  version: number;
  required_variables: string[];
  is_active: boolean;
  archived_at: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentTemplatePayload {
  name: string;
  template_type: DocumentTemplateType;
  description: string | null;
  required_variables: string[];
  file: File;
}

export interface UpdateDocumentTemplatePayload {
  name?: string;
  description?: string | null;
  is_active?: boolean;
}
