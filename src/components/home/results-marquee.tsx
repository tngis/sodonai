"use client";

import { useEffect, useState } from "react";
import { Star, Users, Sparkles, UserRound, Mountain, IdCard, Camera, type LucideIcon } from "lucide-react";
import { getPublicShowcase } from "@/app/actions/showcase";

// Social-proof "results wall": a seamless scrolling strip of real, user-shared
// outputs. Only images whose owner enabled the public showcase AND that are
// individually marked "show to others" reach this (see actions/showcase.ts).
// Until those load — or if none are shared yet — it falls back to decorative
// icon tiles so the section never looks broken. CSS-animation based; the global
// prefers-reduced-motion guard freezes it.

const TILES: { icon: LucideIcon; name: string }[] = [
  { icon: Users, name: "Гэр бүл" },
  { icon: Sparkles, name: "Сэргээлт" },
  { icon: UserRound, name: "Портрет" },
  { icon: Mountain, name: "Фон" },
  { icon: IdCard, name: "ID зураг" },
  { icon: Camera, name: "Студи" },
];

// Repeat a small set so the row is wide enough to read as a continuous strip
// before it's duplicated for the seamless -50% loop.
function fill<T>(arr: T[], min = 6): T[] {
  if (arr.length === 0) return arr;
  const out = [...arr];
  while (out.length < min) out.push(...arr);
  return out;
}

function FallbackRow({ reverse = false }: { reverse?: boolean }) {
  const tiles = [...TILES, ...TILES];
  return (
    <div
      className="flex w-max gap-5"
      style={{ animation: `${reverse ? "marquee-rev" : "marquee"} 32s linear infinite` }}
    >
      {tiles.map((tile, i) => {
        const Icon = tile.icon;
        return (
          <div
            key={i}
            className="flex h-28 w-28 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl bg-background shadow-(--shadow-card)"
          >
            <Icon size={32} className="text-muted-foreground" strokeWidth={1.5} />
            <span className="text-[10px] font-medium text-muted-foreground">{tile.name}</span>
          </div>
        );
      })}
    </div>
  );
}

function ImageRow({ images, reverse = false }: { images: string[]; reverse?: boolean }) {
  const unit = fill(images);
  const tiles = [...unit, ...unit];
  return (
    <div
      className="flex w-max gap-5"
      style={{ animation: `${reverse ? "marquee-rev" : "marquee"} 40s linear infinite` }}
    >
      {tiles.map((src, i) => (
        <div
          key={i}
          className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-muted shadow-(--shadow-card)"
        >
          {/* Plain <img>: R2 presigned URLs sidestep next/image domain config,
              and these tiles are decorative + fixed-size. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}

export function ResultsMarquee() {
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    getPublicShowcase().then(setImages).catch(() => {});
  }, []);

  const hasImages = images.length > 0;
  // Split across the two opposing rows. With a single image both rows mirror it.
  const half = Math.ceil(images.length / 2);
  const rowA = images.slice(0, half);
  const rest = images.slice(half);
  const rowB = rest.length ? rest : rowA;

  return (
    <div className="flex flex-col gap-5">
      {/* Marquee rows must clip horizontally (the duplicated track slides), so
          overflow-hidden stays — but py-6 gives the tiles' neumorphic shadows
          vertical breathing room, and mask-fade-x turns the hard marquee edge
          into a soft dissolve. No background fill: the page-level grain
          (body::after) shows through so the texture stays continuous. */}
      <div className="overflow-hidden mask-fade-x py-6">
        {hasImages ? <ImageRow images={rowA} /> : <FallbackRow />}
      </div>
      <div className="overflow-hidden mask-fade-x py-6">
        {hasImages ? <ImageRow images={rowB} reverse /> : <FallbackRow reverse />}
      </div>

      {/* Rating line */}
      <div className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <div className="flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={14} className="fill-primary text-primary" />
          ))}
        </div>
        <span>10,000+ зураг бүтээгдсэн</span>
      </div>
    </div>
  );
}
