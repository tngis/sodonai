import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Save an image to the device. On phones (iOS/Android) we share the file so the
// OS share sheet offers "Save Image" → Photos / camera roll. A plain <a download>
// on iOS lands in Files instead, which is why we prefer sharing when available.
// Falls back to a normal download on desktop or when file-sharing isn't supported.
export async function saveImageToDevice(url: string, baseName: string): Promise<void> {
  const res = await fetch(url);
  const blob = await res.blob();
  const type = blob.type || "image/jpeg";
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const filename = `${baseName}.${ext}`;
  const file = new File([blob], filename, { type });

  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
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
