import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Пресет",
  description: "Пресетийн тайлбар, анхаарах зүйлс, жишээ болон харьцуулалт.",
};

export default function PresetDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
