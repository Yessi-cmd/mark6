import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "天天好彩｜安全干净的六合资料站",
  description: "面向长者的大字版六合资料与历史记录查询站。无广告、无支付、无外链。",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "天天好彩" },
  openGraph: {
    title: "天天好彩｜安全干净的六合资料站",
    description: "大字、无广告、无支付、无外链。",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "天天好彩：安全、干净、看得清" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "天天好彩｜安全干净的六合资料站",
    description: "大字、无广告、无支付、无外链。",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#174f3d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
