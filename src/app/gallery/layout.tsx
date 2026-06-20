import type { Metadata } from "next";
export const metadata: Metadata = { title: "Галерей", robots: { index: false, follow: false } };
export default function GalleryLayout({ children }: { children: React.ReactNode }) { return children; }
