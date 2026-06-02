import "server-only";

// QPay payment gateway abstraction.
// Set QPAY_MOCK=false and fill QPAY_* env vars to go live.
// Real API docs: https://qpay.mn/docs/merchant/

export interface QPayDeepLink {
  name: string;
  link: string;
}

export interface QPayInvoice {
  invoiceId: string;
  qrImage: string;       // base64 data URL (PNG or SVG)
  deepLinks: QPayDeepLink[];
}

export interface QPayCheckResult {
  paid: boolean;
  paidAt?: string;       // ISO timestamp
}

const IS_MOCK = process.env.QPAY_MOCK !== "false";
const MOCK_DELAY_MS = Number(process.env.QPAY_MOCK_DELAY_MS ?? "5000");

// ── Mock QR (looks like a QR code, clearly labelled TEST) ────────────────────
const MOCK_QR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="white"/>
  <rect x="10" y="10" width="58" height="58" fill="black"/>
  <rect x="18" y="18" width="42" height="42" fill="white"/>
  <rect x="26" y="26" width="26" height="26" fill="black"/>
  <rect x="132" y="10" width="58" height="58" fill="black"/>
  <rect x="140" y="18" width="42" height="42" fill="white"/>
  <rect x="148" y="26" width="26" height="26" fill="black"/>
  <rect x="10" y="132" width="58" height="58" fill="black"/>
  <rect x="18" y="140" width="42" height="42" fill="white"/>
  <rect x="26" y="148" width="26" height="26" fill="black"/>
  <rect x="80" y="10" width="8" height="8" fill="black"/>
  <rect x="96" y="10" width="8" height="8" fill="black"/>
  <rect x="112" y="10" width="8" height="8" fill="black"/>
  <rect x="80" y="26" width="8" height="8" fill="black"/>
  <rect x="112" y="26" width="8" height="8" fill="black"/>
  <rect x="80" y="42" width="8" height="8" fill="black"/>
  <rect x="96" y="42" width="8" height="8" fill="black"/>
  <rect x="112" y="42" width="8" height="8" fill="black"/>
  <rect x="80" y="80" width="8" height="8" fill="black"/>
  <rect x="96" y="80" width="8" height="8" fill="black"/>
  <rect x="112" y="80" width="8" height="8" fill="black"/>
  <rect x="128" y="80" width="8" height="8" fill="black"/>
  <rect x="144" y="80" width="8" height="8" fill="black"/>
  <rect x="160" y="80" width="8" height="8" fill="black"/>
  <rect x="80" y="96" width="8" height="8" fill="black"/>
  <rect x="112" y="96" width="8" height="8" fill="black"/>
  <rect x="144" y="96" width="8" height="8" fill="black"/>
  <rect x="80" y="112" width="8" height="8" fill="black"/>
  <rect x="96" y="112" width="8" height="8" fill="black"/>
  <rect x="128" y="112" width="8" height="8" fill="black"/>
  <rect x="160" y="112" width="8" height="8" fill="black"/>
  <rect x="80" y="128" width="8" height="8" fill="black"/>
  <rect x="96" y="128" width="8" height="8" fill="black"/>
  <rect x="112" y="128" width="8" height="8" fill="black"/>
  <rect x="80" y="144" width="8" height="8" fill="black"/>
  <rect x="128" y="144" width="8" height="8" fill="black"/>
  <rect x="144" y="144" width="8" height="8" fill="black"/>
  <rect x="160" y="144" width="8" height="8" fill="black"/>
  <rect x="80" y="160" width="8" height="8" fill="black"/>
  <rect x="96" y="160" width="8" height="8" fill="black"/>
  <rect x="128" y="160" width="8" height="8" fill="black"/>
  <rect x="160" y="160" width="8" height="8" fill="black"/>
  <text x="100" y="193" text-anchor="middle" font-size="9" fill="#aaa" font-family="monospace">TEST MODE</text>
</svg>`;

const MOCK_QR_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(MOCK_QR_SVG).toString("base64")}`;

const MOCK_DEEP_LINKS: QPayDeepLink[] = [
  { name: "Хаан банк",   link: "khanbank://qpay?qpay_invoice_no=MOCK_ID" },
  { name: "Голомт банк", link: "golomtbank://qpay?qpay_invoice_no=MOCK_ID" },
  { name: "ТДБ",         link: "tdbbank://qpay?qpay_invoice_no=MOCK_ID" },
  { name: "Хас банк",   link: "xacbank://qpay?qpay_invoice_no=MOCK_ID" },
  { name: "Төрийн банк", link: "statebank://qpay?qpay_invoice_no=MOCK_ID" },
  { name: "Капитрон",   link: "capitronbank://qpay?qpay_invoice_no=MOCK_ID" },
];

// ── Mock implementations ─────────────────────────────────────────────────────

function mockCreateInvoice(orderId: string): QPayInvoice {
  const invoiceId = `mock_${orderId.slice(0, 8)}`;
  const deepLinks = MOCK_DEEP_LINKS.map((d) => ({
    ...d,
    link: d.link.replace("MOCK_ID", invoiceId),
  }));
  return { invoiceId, qrImage: MOCK_QR_DATA_URL, deepLinks };
}

function mockCheckPayment(createdAt: string): QPayCheckResult {
  const age = Date.now() - new Date(createdAt).getTime();
  if (age >= MOCK_DELAY_MS) {
    return { paid: true, paidAt: new Date().toISOString() };
  }
  return { paid: false };
}

// ── Real QPay stubs (fill in when credentials are ready) ────────────────────
// Required env vars: QPAY_USERNAME, QPAY_PASSWORD, QPAY_INVOICE_CODE, QPAY_API_URL

async function realCreateInvoice(
  orderId: string,
  amountMnt: number,
  description: string
): Promise<QPayInvoice> {
  // TODO:
  // 1. POST {QPAY_API_URL}/v2/auth/token (Basic auth) → access_token
  // 2. POST {QPAY_API_URL}/v2/invoice:
  //    { invoice_code: QPAY_INVOICE_CODE, sender_invoice_no: orderId,
  //      invoice_receiver_code: "terminal", invoice_description: description,
  //      amount: amountMnt, callback_url: "{APP_URL}/api/webhooks/qpay" }
  // 3. Return { invoiceId: res.invoice_id, qrImage: `data:image/png;base64,${res.qr_image}`, deepLinks: res.urls }
  void orderId; void amountMnt; void description;
  throw new Error("Real QPay not configured — set QPAY_MOCK=false only after adding credentials.");
}

async function realCheckPayment(invoiceId: string): Promise<QPayCheckResult> {
  // TODO:
  // 1. POST {QPAY_API_URL}/v2/payment/check (Bearer token):
  //    { object_type: "INVOICE", object_id: invoiceId }
  // 2. Return { paid: res.count > 0, paidAt: res.rows?.[0]?.payment_date }
  void invoiceId;
  throw new Error("Real QPay not configured.");
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function createInvoice(
  orderId: string,
  amountMnt: number,
  description: string
): Promise<QPayInvoice> {
  if (IS_MOCK) return mockCreateInvoice(orderId);
  return realCreateInvoice(orderId, amountMnt, description);
}

export async function checkPayment(
  invoiceId: string,
  createdAt: string
): Promise<QPayCheckResult> {
  if (IS_MOCK) return mockCheckPayment(createdAt);
  return realCheckPayment(invoiceId);
}
