export type TechnicalSpecificationStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "issued"
  | "cancelled";

export type TechnicalSpecificationFormData = Record<
  string,
  unknown
>;

export interface TechnicalSpecification {
  id: number;
  counterparty_id: number;
  counterparty_name: string;
  contract_id: number | null;
  contract_number: string | null;
  template_id: number;
  template_name: string;
  title: string;
  procurement_subject: string;
  procurement_procedure: string;
  legal_basis: string;
  internal_regulation_document: string;
  approval_date: string | null;
  work_start_date: string | null;
  work_end_date: string | null;
  status: TechnicalSpecificationStatus;
  form_data: TechnicalSpecificationFormData;
  generated_file_name: string | null;
  archived_at: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTechnicalSpecificationPayload {
  counterparty_id: number;
  contract_id?: number | null;
  template_id: number;
  title: string;
  procurement_subject: string;
  procurement_procedure: string;
  legal_basis: string;
  internal_regulation_document: string;
  approval_date?: string | null;
  work_start_date?: string | null;
  work_end_date?: string | null;
  form_data: TechnicalSpecificationFormData;
}

export type UpdateTechnicalSpecificationPayload =
  Partial<CreateTechnicalSpecificationPayload>;
