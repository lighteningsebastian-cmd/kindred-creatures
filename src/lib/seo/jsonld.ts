/**
 * Typed JSON-LD builders.
 *
 * Every function here is pure: it takes what it needs as an argument, reads no
 * environment and touches no network, and returns a plain object ready for
 * JSON.stringify inside a <script type="application/ld+json">.
 *
 * What is deliberately absent: aggregateRating and review. We have no real
 * customer reviews. The landing page's testimonials are placeholder copy, so
 * marking them up as Review would be inventing social proof, which is both
 * dishonest and something Google penalises. If real reviews ever exist, add a
 * builder that reads them from wherever they actually live.
 */
import type { FaqEntry, HowItWorksStep } from "@/lib/content";
import { DELIVERY_DAYS } from "@/lib/content";
import type { Product, Variant } from "@/lib/products";

const SCHEMA_CONTEXT = "https://schema.org";

/** Anything we hand to <script type="application/ld+json">. */
export interface JsonLd {
  "@context": typeof SCHEMA_CONTEXT;
  "@type": string;
  [key: string]: unknown;
}

/**
 * Guards a required field. Structured data that silently ships an undefined
 * name or a blank url is worse than no structured data: it validates as broken
 * rather than absent. Failing loudly at build time is the point.
 */
function required<T>(value: T, field: string): NonNullable<T> {
  if (value === undefined || value === null) {
    throw new Error(`JSON-LD: missing required field "${field}"`);
  }
  if (typeof value === "string" && value.trim() === "") {
    throw new Error(`JSON-LD: required field "${field}" is empty`);
  }
  if (Array.isArray(value) && value.length === 0) {
    throw new Error(`JSON-LD: required field "${field}" is empty`);
  }
  return value as NonNullable<T>;
}

function requiredHttpUrl(value: string, field: string): string {
  const url = required(value, field);
  if (!/^https?:\/\//.test(url)) {
    throw new Error(`JSON-LD: field "${field}" must be an absolute URL, got "${url}"`);
  }
  return url;
}

/** The stable @id every other node points its `brand`/`publisher` at. */
export function organizationId(baseUrl: string): string {
  return `${requiredHttpUrl(baseUrl, "baseUrl").replace(/\/+$/, "")}/#organization`;
}

export interface OrganizationInput {
  /** Site origin, no trailing slash, e.g. https://kindredcreatures.co.za */
  baseUrl: string;
  name: string;
  email: string;
  /**
   * Absolute URL of a brand logo. Omitted when we have no logo asset: the
   * wordmark is set in Young Serif rather than drawn, and public/ holds nothing
   * but leftover scaffold SVGs. Passing the Next.js scaffold favicon here would
   * be publishing someone else's mark as ours. Wire this up when a real logo
   * file exists.
   */
  logoUrl?: string;
  /**
   * Verified social profile URLs. Left empty on purpose: we have no accounts
   * yet, and pointing sameAs at profiles that do not exist (or that someone
   * else owns) is a fabrication. Fill this in once the accounts are real.
   */
  sameAs?: string[];
}

export function buildOrganization(input: OrganizationInput): JsonLd {
  const baseUrl = requiredHttpUrl(input.baseUrl, "baseUrl").replace(/\/+$/, "");
  const organization: JsonLd = {
    "@context": SCHEMA_CONTEXT,
    "@type": "Organization",
    "@id": organizationId(baseUrl),
    name: required(input.name, "name"),
    url: baseUrl,
    description:
      "Custom pet portrait apparel. You send a photo of your pet, we turn it into portrait artwork, and we print it on a hoodie, tee, crewneck or tote in Cape Town.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Cape Town",
      addressCountry: "ZA",
    },
    areaServed: {
      "@type": "Country",
      name: "South Africa",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: required(input.email, "email"),
      availableLanguage: "en",
    },
    email: input.email,
  };

  if (input.logoUrl) {
    organization.logo = requiredHttpUrl(input.logoUrl, "logoUrl");
  }
  if (input.sameAs && input.sameAs.length > 0) {
    organization.sameAs = input.sameAs;
  }

  return organization;
}

export interface WebSiteInput {
  baseUrl: string;
  name: string;
}

export function buildWebSite(input: WebSiteInput): JsonLd {
  const baseUrl = requiredHttpUrl(input.baseUrl, "baseUrl").replace(/\/+$/, "");
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebSite",
    "@id": `${baseUrl}/#website`,
    name: required(input.name, "name"),
    url: baseUrl,
    inLanguage: "en-ZA",
    publisher: { "@id": organizationId(baseUrl) },
  };
}

export interface ProductJsonLdInput {
  baseUrl: string;
  product: Product;
  /** Absolute URLs of the shots the product page actually renders. */
  images: string[];
  /**
   * The variant the offer quotes. Defaults to the cheapest, which is what the
   * "from R x" label on the page means.
   */
  variant?: Variant;
}

/**
 * Product + a single Offer in ZAR.
 *
 * Price is the variant's whole-rand priceZar, emitted as a number. No rating,
 * no reviews: see the note at the top of this file.
 */
export function buildProduct(input: ProductJsonLdInput): JsonLd {
  const baseUrl = requiredHttpUrl(input.baseUrl, "baseUrl").replace(/\/+$/, "");
  const product = required(input.product, "product");
  const images = required(input.images, "images");
  const variant =
    input.variant ??
    product.variants.reduce((cheapest, candidate) =>
      candidate.priceZar < cheapest.priceZar ? candidate : cheapest,
    );

  required(variant, "variant");
  if (!Number.isFinite(variant.priceZar) || variant.priceZar <= 0) {
    throw new Error(
      `JSON-LD: product "${product.slug}" has a non-positive price: ${variant.priceZar}`,
    );
  }

  const url = `${baseUrl}/products/${required(product.slug, "product.slug")}`;

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Product",
    "@id": `${url}#product`,
    name: required(product.name, "product.name"),
    description: required(product.blurb, "product.blurb"),
    image: images.map((image, index) => requiredHttpUrl(image, `images[${index}]`)),
    url,
    category: "Custom pet portrait apparel",
    brand: { "@id": organizationId(baseUrl) },
    offers: {
      "@type": "Offer",
      "@id": `${url}#offer`,
      url,
      priceCurrency: "ZAR",
      price: variant.priceZar,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": organizationId(baseUrl) },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "ZA",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          // Printing starts once the customer approves the portrait, so the
          // five working days are the transit-and-handling window we promise
          // from that moment, not from checkout.
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: 0,
            maxValue: 0,
            unitCode: "DAY",
          },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: DELIVERY_DAYS,
            maxValue: DELIVERY_DAYS,
            unitCode: "DAY",
          },
        },
      },
    },
  };
}

/**
 * FAQPage from the site's real FAQ copy. Built from lib/content's FAQS so the
 * markup and the rendered page can never disagree.
 */
export function buildFaqPage(faqs: FaqEntry[]): JsonLd {
  required(faqs, "faqs");
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "FAQPage",
    mainEntity: faqs.map((faq, index) => ({
      "@type": "Question",
      name: required(faq.question, `faqs[${index}].question`),
      acceptedAnswer: {
        "@type": "Answer",
        text: required(faq.answer, `faqs[${index}].answer`),
      },
    })),
  };
}

export interface HowToInput {
  name: string;
  description: string;
  steps: HowItWorksStep[];
}

/** HowTo for the customization process, from the real how-it-works steps. */
export function buildHowTo(input: HowToInput): JsonLd {
  const steps = required(input.steps, "steps");
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "HowTo",
    name: required(input.name, "name"),
    description: required(input.description, "description"),
    totalTime: `P${DELIVERY_DAYS}D`,
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: required(step.title, `steps[${index}].title`),
      text: required(step.body, `steps[${index}].body`),
    })),
  };
}

export interface BreadcrumbItem {
  name: string;
  /** Site-relative path, e.g. "/products/hoodie". */
  path: string;
}

export function buildBreadcrumbList(
  baseUrl: string,
  items: BreadcrumbItem[],
): JsonLd {
  const base = requiredHttpUrl(baseUrl, "baseUrl").replace(/\/+$/, "");
  required(items, "items");
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: required(item.name, `items[${index}].name`),
      item: `${base}${required(item.path, `items[${index}].path`)}`,
    })),
  };
}
