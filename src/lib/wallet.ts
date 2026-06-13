// Shared wallet constants + helpers. Client-safe (no secrets, no "server-only"),
// so both the server actions and the wallet UI import from here.
//
// The balance is real money, 1:1 with MNT (1 ₮ = 1 unit), so amounts line up
// directly with order/preset prices.

/** Quick top-up amounts shown as one-tap chips on the wallet page. */
export const TOPUP_PRESETS = [5000, 10000, 20000, 50000] as const;

export const MIN_TOPUP_MNT = 1000;
export const MAX_TOPUP_MNT = 1_000_000;

/** A top-up amount must be a whole ₮ value within the allowed range. */
export function isValidTopUpAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount >= MIN_TOPUP_MNT && amount <= MAX_TOPUP_MNT;
}

/** Format a ₮ amount for display, e.g. 12000 → "₮12,000". */
export function formatMnt(amount: number): string {
  return `₮${Math.round(amount).toLocaleString()}`;
}
