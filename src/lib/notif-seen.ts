// Tracks when the user last opened their notifications, so the header bell can
// show an unread count. Stored in localStorage (in-app only — no SMS/email/push).
// A "notification" is a generation that finished after this timestamp.

export const NOTIF_SEEN_KEY = "sodon_notif_last_seen";

export function getLastSeen(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(NOTIF_SEEN_KEY) || "0");
}

export function markSeenNow(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIF_SEEN_KEY, String(Date.now()));
  // Notify same-tab listeners (storage event only fires across tabs).
  window.dispatchEvent(new Event("notif-seen"));
}
