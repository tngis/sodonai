import type { Database } from "@/lib/supabase/types";

type AddressRow = Database["public"]["Tables"]["addresses"]["Row"];

export interface AddressInput {
  label?: string | null;
  recipient: string;
  phone: string;
  city: string;
  district?: string | null;
  khoroo?: string | null;
  detail: string;
  note?: string | null;
  is_default?: boolean;
}

// Format an address into a single human-readable line for snapshots / display.
export function formatAddress(
  a: Pick<AddressRow, "city" | "district" | "khoroo" | "detail">
): string {
  return [a.city, a.district, a.khoroo, a.detail].filter(Boolean).join(", ");
}
