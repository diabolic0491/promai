export type ContractDocumentSource =
  | "generated"
  | "uploaded";

export interface ContractDocumentVersion {
  id: number;
  contract_id: number;
  version_number: number;
  source: ContractDocumentSource;
  template_id: number | null;
  template_name: string | null;
  template_version: number | null;
  source_data: Record<string, unknown>;
  file_name: string;
  file_sha256: string | null;
  file_size_bytes: number | null;
  created_by_user_id: number | null;
  created_at: string;
}
