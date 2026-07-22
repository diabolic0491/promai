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

export type ContractStatus =
  | "draft"
  | "pending_approval"
  | "active"
  | "completed"
  | "terminated"
  | "archived";

export interface Contract {
  id: number;
  counterparty_id: number;

  number: string;
  title: string;

  contract_date: string;
  start_date: string | null;
  end_date: string | null;

  amount: string | null;
  currency: string;

  status: ContractStatus;
  notes: string | null;

  owner_role: ContractPartyRole;
  counterparty_role: ContractPartyRole;

  created_at: string;
  updated_at: string;
}

export interface CreateContractPayload {
  counterparty_id: number;

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
}

export interface UpdateContractPayload {
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
}