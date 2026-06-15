// Shared public-sharing discount math. Client-safe (no secrets, no "server-only")
// so the generate screen and the server actions compute the exact same numbers.
//
// Sharing a generation to the public feed earns a per-preset percentage discount
// on its price. The result is snapshotted onto the generation at creation time
// (see migration 0020) and replayed when the user un-shares — never recomputed,
// because the preset's price/percent may have changed in the meantime.

export interface ShareDiscount {
  /** The preset's full price (₮). */
  full: number;
  /** Discount earned by sharing (₮); 0 when not shared or the preset has none. */
  discount: number;
  /** What the user actually pays (₮) = full - discount. */
  paid: number;
}

/**
 * Compute the price for a generation given whether it's shared to the feed.
 * Discount is a whole percent of the full price, rounded to the nearest ₮.
 */
export function computeShareDiscount(
  fullPriceMnt: number,
  discountPct: number,
  shared: boolean,
): ShareDiscount {
  const full = Math.max(0, Math.round(fullPriceMnt));
  const pct = Math.min(Math.max(discountPct, 0), 100);
  if (!shared || pct <= 0) return { full, discount: 0, paid: full };
  const discount = Math.round((full * pct) / 100);
  return { full, discount, paid: full - discount };
}
