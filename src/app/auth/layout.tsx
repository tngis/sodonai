import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Нэвтрэх",
  description: "aistudio.mn-д нэвтрэх эсвэл бүртгүүлэх.",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
