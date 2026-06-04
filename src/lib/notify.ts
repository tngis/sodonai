import "server-only";

// Notification seam — where SMS / email / push would be sent.
// For now it logs a structured line (same style as the generation logs) so the
// events are observable. Swap the body for a real provider later without
// touching the call sites.

export type NotifyEvent =
  | "print.order.created"
  | "print.production.updated"
  | "print.delivery.updated";

export async function notify(
  event: NotifyEvent,
  payload: Record<string, unknown>
): Promise<void> {
  console.log(JSON.stringify({ event, ...payload, ts: new Date().toISOString() }));
  // TODO: integrate SMS (e.g. Mongolian gateway) / email here.
}
