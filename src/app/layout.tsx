import type { Metadata } from "next";
import { Young_Serif, Archivo } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";

// Young Serif (weight 400 only) drives display headlines, product names, quotes.
const display = Young_Serif({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// Archivo drives body/UI (400/600) and the varsity block eyebrows/CTAs (900).
const body = Archivo({
  variable: "--font-body-sans",
  subsets: ["latin"],
  weight: ["400", "600", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kindred Creatures",
  description:
    "Custom apparel starring your favourite creature. Printed in South Africa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} antialiased`}
    >
      <body className="flex min-h-[100dvh] flex-col bg-base text-ink">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
