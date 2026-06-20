import "server-only";
import sharp from "sharp";

export interface AIGenerateInput {
  /** Which model to run — set per-preset in the DB (ai_model). */
  model: string;
  imageUrls: string[];
  prompt: string;
  options: {
    ratio?: string;
    background?: string | null;
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

// ── OpenAI image adapter (GPT Image, a.k.a. "ChatGPT Image 2" / gpt-image-2) ──
// Uses the Images *edits* endpoint so the user's uploaded photos are passed as
// references and transformed by the preset prompt. GPT Image returns base64,
// which storeOutputFile() persists to the outputs bucket downstream.

// gpt-image-1 only supports a fixed set of sizes. Map our preset ratio strings
// to the nearest portrait/landscape/square; unknown ("Original") → "auto".
function ratioToSize(ratio?: string): "1024x1024" | "1536x1024" | "1024x1536" | "auto" {
  const m = (ratio ?? "").match(/^\s*(\d+)\s*:\s*(\d+)\s*$/);
  if (!m) return "auto";
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (w === h) return "1024x1024";
  return w > h ? "1536x1024" : "1024x1536";
}

async function openaiImageAdapter(input: AIGenerateInput): Promise<AIGenerateOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  // No key configured yet → behave like the mock so local dev still works.
  if (!apiKey) return mockAdapter();

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const count = Math.max(1, Number(process.env.OPENAI_IMAGE_COUNT || "1"));
  const quality = process.env.OPENAI_IMAGE_QUALITY || "medium"; // low | medium | high | auto
  // input_fidelity preserves the uploaded face/details, but only gpt-image-1
  // supports it — gpt-image-2 rejects the parameter. Gate it to supporting models.
  const inputFidelity = process.env.OPENAI_INPUT_FIDELITY || "high"; // low | high
  const supportsFidelity = model === "gpt-image-1";

  // Longest-side cap for source images. Smaller = fewer input tokens (cheaper)
  // and faster uploads; OpenAI downscales internally anyway, so there's little
  // quality gain above ~1024–1536. Default 1024.
  const maxDim = Math.max(256, Number(process.env.OPENAI_INPUT_MAX_DIM || "1024"));

  let prompt = input.prompt;
  if (input.options.background) prompt += `\nBackground: ${input.options.background}.`;

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("n", String(count));
  form.append("size", ratioToSize(input.options.ratio));
  if (quality && quality !== "auto") form.append("quality", quality);
  if (supportsFidelity && inputFidelity) form.append("input_fidelity", inputFidelity);

  // Fetch the (short-lived, signed) source images and attach them as files.
  // GPT Image accepts multiple reference images via the repeated "image[]" field.
  //
  // We re-encode every input to a clean sRGB PNG with sharp first. Uploads may be
  // HEIC/HEIF (iPhone default), CMYK/16-bit/palette, or huge — all of which the
  // OpenAI edits endpoint rejects as "invalid_image_file". Normalizing here:
  //   • decodes HEIC/JPEG/PNG/WebP
  //   • auto-orients from EXIF (so portrait photos aren't sent sideways)
  //   • flattens transparency onto white and forces sRGB (fixes "mode" errors)
  //   • caps the longest side so we never exceed the model's input limits
  await Promise.all(
    input.imageUrls.map(async (url, i) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Failed to fetch source image ${i}: ${r.status}`);
      const raw = Buffer.from(await r.arrayBuffer());
      const png = await sharp(raw, { failOn: "none" })
        .rotate()
        .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .toColourspace("srgb")
        .png()
        .toBuffer();
      form.append("image[]", new Blob([new Uint8Array(png)], { type: "image/png" }), `source_${i}.png`);
    })
  );

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI image API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const images = (data.data ?? [])
    .map((d) => (d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url))
    .filter((x): x is string => Boolean(x));

  if (images.length === 0) throw new Error("OpenAI returned no images.");
  return { imageUrls: images };
}

// Map specific model identifiers to dedicated adapters as you add providers.
// Anything not listed here falls back to the generic gateway above, so a single
// backend keeps working with zero changes.
const ADAPTERS: Record<string, AIAdapter> = {
  "chatgpt-2-image": openaiImageAdapter,
};

// Routes a generation request to the adapter for its preset's model.
export async function callAI(input: AIGenerateInput): Promise<AIGenerateOutput> {
  const adapter = ADAPTERS[input.model] ?? gatewayAdapter;
  return adapter(input);
}
