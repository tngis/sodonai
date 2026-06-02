import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Тохиргоо",
  description: "Хэл, загвар, нууцлал, данс тохируулах.",
  robots: { index: false, follow: false },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
