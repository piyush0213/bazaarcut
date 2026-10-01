import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BazaarCut",
  description:
    "One product photo in. A Meesho catalog shot, an Instagram square, and a story out.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
