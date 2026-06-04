import "server-only";

export interface AIGenerateInput {
  /** Which model to run — set per-preset in the DB (ai_model). */
  model: string;
  imageUrls: string[];
  prompt: string;
  options: {
    ratio?: string;
    background?: string | null;
    intensity?: number | null;
  };
}

export interface AIGenerateOutput {
  imageUrls: string[];
}

// An adapter knows how to call ONE provider/model family and normalize its
// response to { imageUrls }. To add a real provider (Replicate, fal, Gemini,
// your own server), write an adapter and register it in ADAPTERS below.
type AIAdapter = (input: AIGenerateInput) => Promise<AIGenerateOutput>;

// A small 1×1 transparent PNG as a stand-in output image.
const MOCK_IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function mockAdapter(): Promise<AIGenerateOutput> {
  await new Promise((r) => setTimeout(r, 3000));
  return { imageUrls: [MOCK_IMAGE_DATA_URL, MOCK_IMAGE_DATA_URL] };
}

// Generic gateway: a single AI_API_URL that accepts a `model` field and routes
// internally. Used for any model that doesn't have a dedicated adapter.
//
// Expected request (POST AI_API_URL):
//   { model, images: string[], prompt, options: {...} }
// Expected response:
//   { images: string[] }  — array of public image URLs or base64 data URIs
async function gatewayAdapter(input: AIGenerateInput): Promise<AIGenerateOutput> {
  const apiUrl = process.env.AI_API_URL;
  const apiKey = process.env.AI_API_KEY;

  // Mock mode: no real API key yet — return a placeholder after a short delay.
  if (!apiUrl || !apiKey || apiUrl.includes("your-ai-backend")) {
    return mockAdapter();
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      images: input.imageUrls,
      prompt: input.prompt,
      options: input.options,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { images?: unknown };
  if (!Array.isArray(data.images) || data.images.length === 0) {
    throw new Error("AI API returned no images.");
  }

  return { imageUrls: data.images as string[] };
}

// Map specific model identifiers to dedicated adapters as you add providers.
// Anything not listed here falls back to the generic gateway above, so a single
// backend keeps working with zero changes.
//
//   const ADAPTERS: Record<string, AIAdapter> = {
//     "flux-kontext":           replicateAdapter,
//     "gemini-2.5-flash-image": geminiAdapter,
//     "restore-v1":             myRestoreServerAdapter,
//   };
const ADAPTERS: Record<string, AIAdapter> = {};

// Routes a generation request to the adapter for its preset's model.
export async function callAI(input: AIGenerateInput): Promise<AIGenerateOutput> {
  const adapter = ADAPTERS[input.model] ?? gatewayAdapter;
  return adapter(input);
}
