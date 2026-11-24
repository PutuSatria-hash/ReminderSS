import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cadence PM — Monitoring Proyek Mobile",
  description:
    "Workspace lokal untuk manajemen tugas, catatan ceklis, diskusi kendala, dan deteksi otomatis aktivitas GitHub tim.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
