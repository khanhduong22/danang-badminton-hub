import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://badminton.khanhdp.com"),
  title: {
    default: "Danang Badminton Hub",
    template: "%s | Danang Badminton Hub",
  },
  description: "Hệ thống cơ sở dữ liệu sân cầu lông và tìm kiếm kèo vãng lai nhanh chóng nhất tại Đà Nẵng.",
  keywords: ["cầu lông đà nẵng", "sân cầu lông đà nẵng", "kèo vãng lai", "đánh cầu lông", "thuê sân cầu lông", "badminton da nang"],
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: "https://badminton.khanhdp.com",
    title: "Danang Badminton Hub - Tìm Sân & Kèo Vãng Lai",
    description: "Cơ sở dữ liệu sân cầu lông và thông tin tìm kiếm vãng lai tại Đà Nẵng. Cập nhật liên tục 24/7.",
    siteName: "Danang Badminton Hub",
    images: [
      {
        url: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=1200&auto=format&fit=crop",
        width: 1200,
        height: 630,
        alt: "Danang Badminton Hub",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Danang Badminton Hub - Tìm Sân & Kèo Vãng Lai",
    description: "Cơ sở dữ liệu sân cầu lông và thông tin tìm kiếm vãng lai tại Đà Nẵng. Cập nhật liên tục 24/7.",
    images: ["https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=1200&auto=format&fit=crop"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${inter.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Navbar />
        <main className="flex-1 flex flex-col">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
