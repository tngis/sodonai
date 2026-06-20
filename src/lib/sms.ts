import "server-only";

// Skytel SMS gateway. Mocked (logs only) until SKYTEL_API_KEY is set to a real
// value — mirrors the QPay mock pattern so local dev works end-to-end.
//
// sendSms never throws: SMS is a best-effort side effect (order-status notices),
// and a gateway hiccup must not fail the admin action that triggered it.
//
// NOTE: the request shape below ({ to, text } + Bearer auth) is a placeholder —
// confirm against Skytel's merchant docs before going live (SKYTEL_API_URL).

const API_URL = process.env.SKYTEL_API_URL;
const API_KEY = process.env.SKYTEL_API_KEY;
const IS_CONFIGURED = !!API_URL && !!API_KEY && API_KEY !== "your-skytel-api-key";

export async function sendSms(phone: string | null | undefined, text: string): Promise<void> {
  const to = (phone ?? "").trim();
  if (!to) return;

  if (!IS_CONFIGURED) {
    console.log(JSON.stringify({ event: "sms.mock", to, text, ts: new Date().toISOString() }));
    return;
  }

  try {
    const res = await fetch(API_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ to, text }),
    });
    const event = res.ok ? "sms.sent" : "sms.failed";
    console.log(JSON.stringify({ event, to, status: res.status, ts: new Date().toISOString() }));
  } catch (err) {
    console.error(JSON.stringify({
      event: "sms.error", to,
      error: err instanceof Error ? err.message : String(err),
      ts: new Date().toISOString(),
    }));
  }
}
