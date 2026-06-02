import "server-only";

export interface AIGenerateInput {
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

// Calls the configured AI image-generation backend.
//
// Expected request format (POST AI_API_URL):
//   { images: string[], prompt: string, options: { ratio?, background?, intensity? } }
//
// Expected response format:
//   { images: string[] }  — array of public image URLs or base64 data URIs
//
// Any image-to-image backend (Replicate, custom Stable Diffusion, etc.) that
// accepts this schema will work. Swap AI_API_URL / AI_API_KEY in .env.local.
// A small 1×1 transparent PNG as a stand-in output image.
const MOCK_IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export async function callAI(input: AIGenerateInput): Promise<AIGenerateOutput> {
  const apiUrl = process.env.AI_API_URL;
  const apiKey = process.env.AI_API_KEY;

  // Mock mode: no real API key yet — return placeholder output after a short delay
  if (!apiUrl || !apiKey || apiUrl.includes("your-ai-backend")) {
    await new Promise((r) => setTimeout(r, 3000));
    return { imageUrls: [MOCK_IMAGE_DATA_URL, MOCK_IMAGE_DATA_URL] };
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
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
