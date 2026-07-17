import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { ProductRange } from "@/components/sections/ProductRange";
import { DeliveryPromise } from "@/components/sections/DeliveryPromise";
import { LoveWall } from "@/components/sections/LoveWall";
import { FaqTeaser } from "@/components/sections/FaqTeaser";
import { JsonLd } from "@/components/seo/JsonLd";
import { FAQS, HOW_IT_WORKS_STEPS } from "@/lib/content";
import { buildFaqPage, buildHowTo } from "@/lib/seo/jsonld";

// The title is the root layout's title.default: a template never applies to the
// segment that defines it, and the homepage wants the full brand line anyway.
// All this adds is the canonical and the page's own description.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  // Both of these describe copy that is rendered on this page, immediately
  // below: the FAQ teaser and the how-it-works steps, from the same constants.
  // S10's /faq page can reuse buildFaqPage(FAQS) as-is.
  const structuredData = [
    buildFaqPage(FAQS),
    buildHowTo({
      name: "How to put your pet's portrait on a hoodie, tee, crewneck or tote",
      description:
        "Upload a photo of your pet, approve the portrait artwork we send back, and we print it in Cape Town and courier it to your door.",
      steps: HOW_IT_WORKS_STEPS,
    }),
  ];

  return (
    <>
      <JsonLd data={structuredData} />
      <Hero />
      <HowItWorks />
      <ProductRange />
      <DeliveryPromise />
      <LoveWall />
      <FaqTeaser />
    </>
  );
}
