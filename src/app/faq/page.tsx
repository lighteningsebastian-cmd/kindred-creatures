import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import { JsonLd } from "@/components/seo/JsonLd";
import { FAQS } from "@/lib/content";
import { buildFaqPage } from "@/lib/seo/jsonld";
import { BRAND_NAME } from "@/lib/seo/site";

const title = "FAQ";
const description = `Answers to the questions people ask before ordering from ${BRAND_NAME}: what you can put your pet on, how good your photo needs to be, the portrait approval step, and how long delivery takes.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/faq" },
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    locale: "en_ZA",
    url: "/faq",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function FaqPage() {
  // Same FAQS the homepage renders and the FAQPage markup describes, so the
  // page, the teaser and the structured data can never disagree.
  const structuredData = buildFaqPage(FAQS);

  return (
    <div className="bg-base py-16 md:py-24">
      <JsonLd data={structuredData} />
      <Container>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-20">
          <div className="flex flex-col items-start gap-5 lg:sticky lg:top-28 lg:h-fit">
            <Reveal>
              <p className="eyebrow text-[11px] text-accent">Good to know</p>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="font-display text-3xl leading-[1.12] text-ink md:text-4xl">
                Questions, answered plainly.
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="max-w-sm leading-relaxed text-muted">
                Everything most people want to know before they order. Still
                unsure about something? Reply to any email from us and a person
                will help.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <Button href="/products/hoodie" block>
                Start your portrait
              </Button>
            </Reveal>
          </div>

          <dl className="flex flex-col">
            {FAQS.map((item, index) => (
              <Reveal key={item.question} delay={index * 0.05}>
                <div className="flex flex-col gap-3 border-t border-line py-8 first:border-t-0 first:pt-0">
                  <dt className="font-display text-xl leading-[1.25] text-ink">
                    {item.question}
                  </dt>
                  <dd className="max-w-xl leading-relaxed text-muted">
                    {item.answer}
                  </dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </Container>
    </div>
  );
}
