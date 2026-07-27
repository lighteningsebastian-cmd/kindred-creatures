import type { Metadata } from "next";
import { Young_Serif, Archivo } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Analytics } from "@/components/analytics/Analytics";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildOrganization, buildWebSite } from "@/lib/seo/jsonld";
import { BRAND_EMAIL, BRAND_NAME, siteUrl } from "@/lib/seo/site";

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

/**
 * Site-wide metadata.
 *
 * metadataBase lets every page below express canonicals and OG URLs as plain
 * relative paths and have them resolve against the real origin.
 *
 * The title template applies to child segments only, so a page sets its own
 * bare title ("The Kindred Hoodie") and gets the brand appended once. Pages
 * must not carry their own "| Kindred Creatures" suffix or it lands twice.
 * `default` is what "/" itself renders, since a template never applies to the
 * segment that defines it.
 *
 * No `alternates.canonical` here on purpose: metadata is inherited, so a
 * canonical set at the root would make every page in the site claim to be the
 * homepage. Each indexable page declares its own.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${BRAND_NAME} · Custom pet portrait apparel, printed in South Africa`,
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    "Send us a photo of your dog, cat, or whoever you love most. We turn it into portrait artwork, print it on a hoodie, tee, crewneck or tote in Jeffreys Bay, and courier it to you within 7 to 10 working days.",
  applicationName: BRAND_NAME,
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    locale: "en_ZA",
    url: "/",
    title: `${BRAND_NAME} · Custom pet portrait apparel, printed in South Africa`,
    description:
      "Upload a photo of your pet. We turn it into portrait artwork and print it on a hoodie, tee, crewneck or tote in Jeffreys Bay, couriered to you within 7 to 10 working days.",
    // No OG image: real brand photography does not exist yet (the site renders
    // hatched PhotoFrame placeholders). A text share card is honest; restore the
    // image here when the shoot lands.
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} · Custom pet portrait apparel, printed in South Africa`,
    description:
      "Upload a photo of your pet. We turn it into portrait artwork and print it on a hoodie, tee, crewneck or tote in Jeffreys Bay, couriered to you within 7 to 10 working days.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Who we are and what this site is, stated once for the whole site. Every
  // other node (a Product's brand, a page's publisher) points back at these by
  // @id rather than repeating them.
  const identity = [
    buildOrganization({
      baseUrl: siteUrl(),
      name: BRAND_NAME,
      email: BRAND_EMAIL,
      // logoUrl and sameAs are omitted: we have no logo asset and no social
      // accounts. See the seams documented on OrganizationInput.
    }),
    buildWebSite({ baseUrl: siteUrl(), name: BRAND_NAME }),
  ];

  return (
    <html
      lang="en-ZA"
      className={`${display.variable} ${body.variable} antialiased`}
    >
      <body className="flex min-h-[100dvh] flex-col bg-base text-ink">
        <JsonLd data={identity} />
        <Analytics />
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
