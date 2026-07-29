export type ContractStatus =
  | "draft"
  | "pending_approval"
  | "active"
  | "completed"
  | "terminated";

export type ContractPartyRole =
  | "supplier"
  | "buyer"
  | "contractor"
  | "customer"
  | "executor"
  | "landlord"
  | "tenant"
  | "lender"
  | "borrower"
  | "other";

export type ContractEventType =
  | "created"
  | "updated"
  | "status_changed"
  | "archived"
  | "restored"
  | "generated"
  | "uploaded";

export type ContractFormData = Record<string, unknown>;

export interface Contract {
  id: number;
  counterparty_id: number;
  counterparty_name: string;
  template_id: number | null;
  template_name: string | null;
  number: string;
  title: string;
  contract_date: string;
  start_date: string | null;
  end_date: string | null;
  amount: string | null;
  currency: string;
  status: ContractStatus;
  archived_at: string | null;
  is_archived: boolean;
  notes: string | null;
  owner_role: ContractPartyRole;
  counterparty_role: ContractPartyRole;
  form_data: ContractFormData;
  generated_file_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateContractPayload {
  counterparty_id: number;
  template_id?: number | null;
  number: string;
  title: string;
  contract_date: string;
  start_date?: string | null;
  end_date?: string | null;
  amount?: string | null;
  currency: string;
  notes?: string | null;
  owner_role: ContractPartyRole;
  counterparty_role: ContractPartyRole;
  form_data: ContractFormData;
}

export interface UpdateContractPayload {
  template_id?: number | null;
  number?: string;
  title?: string;
  contract_date?: string;
  start_date?: string | null;
  end_date?: string | null;
  amount?: string | null;
  currency?: string;
  notes?: string | null;
  owner_role?: ContractPartyRole;
  counterparty_role?: ContractPartyRole;
  form_data?: ContractFormData;
}

export interface ContractStatusHistoryEntry {
  id: number;
  contract_id: number;
  from_status: ContractStatus | null;
  to_status: ContractStatus;
  changed_by_user_id: number | null;
  changed_at: string;
}

export interface ContractEvent {
  id: number;
  contract_id: number;
  event_type: ContractEventType;
  event_data: Record<string, unknown> | null;
  actor_user_id: number | null;
  created_at: string;
}
