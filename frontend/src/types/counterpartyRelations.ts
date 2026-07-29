import type { ContractStatus } from "./contract";

export interface RelatedContract {
  id: number;
  number: string;
  title: string;
  contract_date: string;
  status: ContractStatus;
  is_archived: boolean;
}

export type { ContractStatus };

export type TechnicalSpecificationStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "issued"
  | "cancelled";

export interface RelatedTechnicalSpecification {
  id: number;
  title: string;
  procurement_subject: string;
  status: TechnicalSpecificationStatus;
  is_archived: boolean;
  updated_at: string;
}
