import Image from "next/image";
import { ART_STYLE_DESCRIPTIONS } from "@/lib/content";
import { ART_STYLE_LABELS, type ArtStyle } from "@/lib/images/provider";

/**
 * One style in the showcase: a sample image, the style's label, and the same
 * one-line description the customizer's StylePicker renders. The label and
 * description are read from the shared sources, so this page and the customizer
 * describe every style identically.
 */
export function StyleCard({ style }: { style: ArtStyle }) {
  const label = ART_STYLE_LABELS[style];

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface">
      {/* TODO: real photo */}
      <div className="relative aspect-square w-full overflow-hidden">
        <Image
          src={`https://picsum.photos/seed/kindred-style-${style}/700/700`}
          alt={`A pet portrait in the ${label.toLowerCase()} style`}
          fill
          sizes="(max-width: 768px) 92vw, 30vw"
          className="object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-6">
        <h3 className="font-display text-xl leading-[1.2] text-ink">{label}</h3>
        <p className="leading-relaxed text-muted">
          {ART_STYLE_DESCRIPTIONS[style]}
        </p>
      </div>
    </article>
  );
}
