import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";

import { AppToaster } from "@/components/app-toaster";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "ARS Arcana",
  title: {
    default: "ARS Arcana — Biblioteca de magias",
    template: "ARS Arcana — %s",
  },
  description:
    "Explore o catálogo completo de magias, salve seus favoritos e organize grimórios para a sua próxima aventura.",
};

export const viewport: Viewport = {
  themeColor: "#143d33",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
