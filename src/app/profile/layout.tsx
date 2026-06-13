import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Профайл",
  description: "Хувийн мэдээлэл, профайл зураг, дуртай пресетүүд.",
  robots: { index: false, follow: false },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
