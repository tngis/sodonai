import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Зураг үүсгэх",
  description: "AI ашиглан зураг үүсгэх. Пресет сонгоод, зургаа оруулаад, хэтэвч эсвэл QPay-р төлнө.",
};

export default function GenerateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
