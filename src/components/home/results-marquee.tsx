"use client";

import { Star } from "lucide-react";

// Social-proof "results wall": a seamless scrolling strip of sample tiles.
// Decorative (emoji + gradient stand-ins until real result imagery exists).
// CSS-animation based; the global prefers-reduced-motion guard freezes it.

const TILES = [
  { emoji: "👨‍👩‍👧", grad: "from-violet-500/30 to-blue-500/30", name: "Гэр бүл" },
  { emoji: "🖼️", grad: "from-amber-500/30 to-orange-500/30", name: "Сэргээлт" },
  { emoji: "✨", grad: "from-lime-400/30 to-emerald-500/30", name: "Портрет" },
  { emoji: "🎨", grad: "from-pink-500/30 to-rose-500/30", name: "Фон" },
  { emoji: "📸", grad: "from-sky-500/30 to-cyan-500/30", name: "ID зураг" },
  { emoji: "🌅", grad: "from-fuchsia-500/30 to-purple-500/30", name: "Студи" },
];

function Row({ reverse = false }: { reverse?: boolean }) {
  const tiles = [...TILES, ...TILES];
  return (
    <div
      className="flex w-max gap-3"
      style={{ animation: `${reverse ? "marquee-rev" : "marquee"} 32s linear infinite` }}
    >
      {tiles.map((tile, i) => (
        <div
          key={i}
          className={`flex h-28 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-linear-to-br ${tile.grad} ring-1 ring-foreground/10`}
        >
          <span className="text-4xl">{tile.emoji}</span>
          <span className="text-[10px] font-medium text-muted-foreground">{tile.name}</span>
        </div>
      ))}
    </div>
  );
}

export function ResultsMarquee() {
  return (
    <div className="flex flex-col gap-3">
      <div
        className="overflow-hidden"
      >
        <Row />
      </div>
      <div
        className="overflow-hidden"
      >
        <Row reverse />
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
