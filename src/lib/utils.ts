import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Is this a phone/tablet? Desktop browsers (notably Chrome/Edge) also implement
// the Web Share API with files, so canShare() alone isn't enough to tell them
// apart — we'd pop a share sheet on desktop where a plain download is expected.
// iPadOS reports a Mac UA, so it's caught via touch points instead.
function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iPadOS = navigator.maxTouchPoints > 1 && /Macintosh/.test(ua);
  return /Android|iPhone|iPad|iPod/i.test(ua) || iPadOS;
}

// Save an image to the device. On phones/tablets (iOS/Android) we share the file
// so the OS share sheet offers "Save Image" → Photos / camera roll. A plain
// <a download> on iOS lands in Files instead, which is why we prefer sharing
// there. On desktop we always download directly to the file system.
export async function saveImageToDevice(url: string, baseName: string): Promise<void> {
  // cache: "reload" is essential, not an optimization. The page first shows this
  // image via <img>/<Image> with no crossOrigin → the browser caches it as an
  // OPAQUE (no-cors) response. Outputs are served with `Cache-Control: immutable`,
  // so that opaque entry sticks and a plain fetch(url) reuses it — which has no
  // CORS info, so the browser rejects it with "blocked by CORS policy" even
  // though R2 returns Access-Control-Allow-Origin on a real request. Forcing a
  // network fetch makes a proper CORS request and gets readable bytes.
  const res = await fetch(url, { cache: "reload" });
  const blob = await res.blob();
  const type = blob.type || "image/jpeg";
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const filename = `${baseName}.${ext}`;
  const file = new File([blob], filename, { type });

  // Mobile only: route through the share sheet so it can land in Photos. Desktop
  // skips this and falls straight through to the direct download below.
  if (
    isMobileDevice() &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      // User dismissed the share sheet — treat as done, don't fall through.
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Any other share failure → fall back to a normal download below.
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}
