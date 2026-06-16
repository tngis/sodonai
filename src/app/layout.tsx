import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Manrope, Montserrat, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/layout/Header";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Toaster } from "@/components/ui/sonner";
import { GenerationNotifier } from "@/components/notifications/generation-notifier";

// Body / UI — modern geometric sans with full Mongolian Cyrillic coverage.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

// Display / headings — geometric display with full Mongolian Cyrillic
// (ө U+04E9 / ү U+04AF live in the cyrillic-ext subset).
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://aistudio.mn";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "aistudio.mn — AI зураг",
    template: "%s — aistudio.mn",
  },
  description: "Промпт бичихгүйгээр AI зураг бүтээх. Гэр бүлийн зураг, ID зураг, хуучин зураг сэргээлт — гурван алхамд бэлэн.",
  keywords: ["AI зураг", "зураг засварлах", "QPay", "Монгол", "aistudio"],
  openGraph: {
    type: "website",
    siteName: "aistudio.mn",
    locale: "mn_MN",
    url: BASE_URL,
    title: "aistudio.mn — AI зураг",
    description: "Промпт бичихгүйгээр AI зураг бүтээх.",
  },
  twitter: { card: "summary", site: "@aistudio_mn" },
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "aistudio", statusBarStyle: "default" },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e0e5ec" },
    { media: "(prefers-color-scheme: dark)", color: "#24272c" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Flat-style preference is a cookie so we can apply the class on the server
  // (before paint, no FOUC). next-themes manages the light/dark class on the
  // client and never strips `flat`, so the two axes compose cleanly.
  const flat = (await cookies()).get("ui-style")?.value === "flat";

  return (
    <html
      lang="mn"
      suppressHydrationWarning
      className={`${manrope.variable} ${montserrat.variable} ${geistMono.variable} h-dvh overflow-hidden antialiased${flat ? " flat" : ""}`}
    >
      {/* suppressHydrationWarning: some browser extensions (e.g. ColorZilla adds
          cz-shortcut-listen) inject attributes on <body> before hydration. */}
      <body className="flex h-full flex-col overflow-hidden" suppressHydrationWarning>
        <Providers>
          <Header />
          <main className="flex-1 overflow-y-auto">
            {/* Padding lives on this inner wrapper, not <main>: WebKit/Blink drop a
                scroll container's own padding-bottom at scroll end, hiding content
                behind the fixed bottom nav. A child's padding is honored. */}
            <div className="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-4">{children}</div>
          </main>
          <MobileBottomNav />
          <Toaster />
          <GenerationNotifier />
        </Providers>
      </body>
    </html>
  );
}
