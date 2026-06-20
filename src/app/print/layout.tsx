import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Хэвлэмэл зураг",
  description: "AI зургаа жаазалж, хэвлүүлж, хүргүүлэн авах.",
  robots: { index: false, follow: false },
};

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return children;
}
