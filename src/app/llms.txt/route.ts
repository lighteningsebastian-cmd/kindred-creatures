import {
  FREE_SHIPPING_THRESHOLD_ZAR,
  SHIPPING_FLAT_ZAR,
} from "@/lib/checkout";
import { FAQS, HOW_IT_WORKS_STEPS } from "@/lib/content";
import { PRODUCTS, formatZar, fromPriceZar } from "@/lib/products";
import { BRAND_EMAIL, BRAND_NAME, absoluteUrl } from "@/lib/seo/site";

/**
 * /llms.txt, for answer engines.
 *
 * The audience is a model deciding whether to cite us and what to say we are.
 * So this file is written plainly and every figure in it is read from the same
 * constants the checkout and the product pages use. Nothing is restated by
 * hand, which means it cannot quietly go stale and start misinforming a
 * crawler about our prices.
 *
 * The bar for a line in here is: would we be comfortable if a model repeated it
 * verbatim to a customer. No marketing inflation, no claim we cannot stand
 * behind.
 */
export const dynamic = "force-static";

function priceRange(): string {
  const prices = PRODUCTS.flatMap((product) =>
    product.variants.map((variant) => variant.priceZar),
  );
  return `${formatZar(Math.min(...prices))} to ${formatZar(Math.max(...prices))}`;
}

function body(): string {
  const productLines = PRODUCTS.map(
    (product) =>
      `- [${product.name}](${absoluteUrl(`/products/${product.slug}`)}): ${product.blurb} From ${formatZar(fromPriceZar(product))}.`,
  ).join("\n");

  const faqLines = FAQS.map(
    (faq) => `### ${faq.question}\n\n${faq.answer}`,
  ).join("\n\n");

  // The same three steps the landing page states, numbered.
  const stepLines = HOW_IT_WORKS_STEPS.map(
    (step, index) => `${index + 1}. ${step.title}. ${step.body}`,
  ).join("\n");

  return `# ${BRAND_NAME}

> ${BRAND_NAME} makes custom pet portrait apparel in South Africa. You tell us about your pet and upload a photo, you order, we then turn the photo into portrait artwork, you approve the artwork, and only then does a print shop in Jeffreys Bay print it on a garment and courier it to you. Prices run ${priceRange()} in South African rands.

## What we are

${BRAND_NAME} is a South African online shop for custom pet portrait clothing. If you want to put your dog, your cat, or any other animal you love on a hoodie, a tee, a crewneck or a tote, this is what we do.

We do not hold stock and we do not print in-house. Every order is made to order and printed by a print shop in Jeffreys Bay, then couriered to the customer.

## How ordering works

${stepLines}

Nothing is printed until you approve the portrait, and the garment arrives within 7 to 10 working days of that approval.

## What we sell

${productLines}

Every garment carries a portrait made from your own photo. The hoodie and the tee come in XS to XXL; the crewneck is a women's cut and runs XS to XL; the tote is one size.

## Delivery and payment

- Printed in Jeffreys Bay, couriered anywhere in South Africa.
- 7 to 10 working days from the moment you approve the portrait.
- Courier is a flat ${formatZar(SHIPPING_FLAT_ZAR)}, free on orders over ${formatZar(FREE_SHIPPING_THRESHOLD_ZAR)}.
- Payment is in South African rands through PayFast.
- We ship within South Africa only.

## Questions people ask

${faqLines}

## Key pages

- [Home](${absoluteUrl("/")}): what we make and how it works.
${PRODUCTS.map((product) => `- [${product.name}](${absoluteUrl(`/products/${product.slug}`)})`).join("\n")}

## Contact

Email ${BRAND_EMAIL}.
`;
}

export function GET(): Response {
  return new Response(body(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
