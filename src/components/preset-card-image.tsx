"use client";

import { useState, type ReactNode } from "react";

// Shows a preset's example_output image; falls back to the category icon on
// load error or missing src. Shared by the category grid and the landing
// featured rail so both render the preset's own image, not the category icon.
export function PresetCardImage({
  src,
  alt,
  fallback,
  className = "h-full w-full object-cover",
}: {
  src: string;
  alt: string;
  fallback: ReactNode;
  className?: string;
}) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        {fallback}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} onError={() => setError(true)} />
  );
}
