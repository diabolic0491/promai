export type CounterpartyStatus = "active" | "archived";

export interface Counterparty {
  id: number;
  unp: string;
  name: string;
  short_name: string | null;
  legal_address: string | null;
  status: CounterpartyStatus;
  created_at: string;
  updated_at: string;
}