// Physical-print catalog — frame designs and print sizes.
// Kept in code (not the DB) by product decision; swap to DB later via the same shape.
// Price is always recomputed server-side from these values — never trust the client.

export interface FrameDesign {
  id: string;
  name_mn: string;
  name_en: string;
  // Tailwind classes applied to the frame border in the live preview.
  swatchClass: string;
  // CSS used for the small selectable swatch chip (a slice of the frame material).
  swatchStyle: string;
  surcharge_mnt: number;
}

export interface PrintSize {
  id: string;
  label: string;       // "20×30 см"
  w_cm: number;
  h_cm: number;
  ratio: string;       // "2:3" — informational
  base_mnt: number;
}

export const FRAMES: FrameDesign[] = [
  {
    id: "none",
    name_mn: "Жаазгүй",
    name_en: "No frame",
    swatchClass: "p-0",
    swatchStyle: "repeating-linear-gradient(45deg,#e5e5e5,#e5e5e5 4px,#f5f5f5 4px,#f5f5f5 8px)",
    surcharge_mnt: 0,
  },
  {
    id: "black",
    name_mn: "Хар орчин үеийн",
    name_en: "Modern black",
    swatchClass: "p-3 bg-neutral-900",
    swatchStyle: "linear-gradient(135deg,#1a1a1a,#3a3a3a)",
    surcharge_mnt: 12000,
  },
  {
    id: "white",
    name_mn: "Цагаан",
    name_en: "White",
    swatchClass: "p-3 bg-neutral-50",
    swatchStyle: "linear-gradient(135deg,#fafafa,#e8e8e8)",
    surcharge_mnt: 12000,
  },
  {
    id: "wood",
    name_mn: "Сонгодог мод",
    name_en: "Classic wood",
    swatchClass: "p-3.5 bg-amber-800",
    swatchStyle: "linear-gradient(135deg,#8a5a2b,#b07d4a 40%,#6e4420)",
    surcharge_mnt: 18000,
  },
  {
    id: "gold",
    name_mn: "Алтлаг",
    name_en: "Gold",
    swatchClass: "p-3.5 bg-yellow-600",
    swatchStyle: "linear-gradient(135deg,#caa24a,#f0d98c 45%,#a9842f)",
    surcharge_mnt: 25000,
  },
];

export const SIZES: PrintSize[] = [
  { id: "10x15", label: "10×15 см", w_cm: 10, h_cm: 15, ratio: "2:3", base_mnt: 9000 },
  { id: "15x21", label: "15×21 см", w_cm: 15, h_cm: 21, ratio: "5:7", base_mnt: 14000 },
  { id: "20x30", label: "20×30 см", w_cm: 20, h_cm: 30, ratio: "2:3", base_mnt: 22000 },
  { id: "30x40", label: "30×40 см", w_cm: 30, h_cm: 40, ratio: "3:4", base_mnt: 35000 },
  { id: "40x60", label: "40×60 см", w_cm: 40, h_cm: 60, ratio: "2:3", base_mnt: 52000 },
];

export const DEFAULT_FRAME_ID = FRAMES[0].id;
export const DEFAULT_SIZE_ID = SIZES[2].id;

export function findFrame(id: string): FrameDesign | undefined {
  return FRAMES.find((f) => f.id === id);
}

export function findSize(id: string): PrintSize | undefined {
  return SIZES.find((s) => s.id === id);
}

// Total price = size base + frame surcharge. Throws on unknown ids so callers
// (especially the server action) fail loudly rather than charging a wrong amount.
export function priceFor(sizeId: string, frameId: string): number {
  const size = findSize(sizeId);
  const frame = findFrame(frameId);
  if (!size) throw new Error(`Тодорхойгүй хэмжээ: ${sizeId}`);
  if (!frame) throw new Error(`Тодорхойгүй жааз: ${frameId}`);
  return size.base_mnt + frame.surcharge_mnt;
}
