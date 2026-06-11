export interface Bank {
  id: string;
  nameMn: string;
  nameEn: string;
  color: string;
}

export const banks: Bank[] = [
  { id: "khan",     nameMn: "Хаан банк",   nameEn: "Khan Bank",    color: "#E31E2D" },
  { id: "golomt",   nameMn: "Голомт банк", nameEn: "Golomt Bank",  color: "#0057A8" },
  { id: "tdb",      nameMn: "ТДБ",         nameEn: "TDB",          color: "#003D99" },
  { id: "xac",      nameMn: "Хас банк",    nameEn: "Xac Bank",     color: "#F47920" },
  { id: "state",    nameMn: "Төрийн банк", nameEn: "State Bank",   color: "#007B3E" },
  { id: "capitron", nameMn: "Капитрон",    nameEn: "Capitron",     color: "#6B2D8B" },
];

// Visual swatch for a background-preset option. Known color names map to a solid
// color; everything else gets a representative gradient so the chip still previews.
export function BG_SWATCHES(name: string): string {
  const map: Record<string, string> = {
    // Mongolian color names
    "Цагаан": "#ffffff",
    "Цэнхэр": "#3b82f6",
    "Саарал": "#9ca3af",
    "Кремэн": "#f5e6c8",
    // English / studio presets
    "Studio White": "#f5f5f5",
    "Dark": "#1f2937",
    "Gradient": "linear-gradient(135deg,#a855f7,#3b82f6)",
    "Colorful": "linear-gradient(135deg,#f59e0b,#ef4444,#8b5cf6)",
    "Studio": "linear-gradient(135deg,#e5e7eb,#9ca3af)",
    "Outdoor": "linear-gradient(135deg,#86efac,#3b82f6)",
    "Home": "linear-gradient(135deg,#fcd34d,#f59e0b)",
    "Family Room": "linear-gradient(135deg,#fdba74,#f97316)",
    "Minimal": "#e5e7eb",
  };
  return map[name] ?? "linear-gradient(135deg,#7f7f7f,#404040)";
}
