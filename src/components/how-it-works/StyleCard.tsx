import { PhotoFrame } from "@/components/ui/PhotoFrame";
import { ART_STYLE_DESCRIPTIONS } from "@/lib/content";
import { ART_STYLE_LABELS, type ArtStyle } from "@/lib/images/provider";

/** The sample shot each style card reserves, art-directed per style. */
const styleShot: Record<ArtStyle, string> = {
  "classic-portrait":
    "sample portrait: a dog rendered as a classic painted pet portrait, rich warm tones, framed head-and-shoulders",
  "line-sketch":
    "sample portrait: a cat rendered as a fine line sketch, confident ink linework on a bare warm ground",
  watercolor:
    "sample portrait: a dog rendered in soft watercolour, loose washes and gentle edges, warm palette",
};

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
      <PhotoFrame
        aspect="1 / 1"
        description={styleShot[style]}
        className="rounded-none border-0"
      />
      <div className="flex flex-1 flex-col gap-2 p-6">
        <h3 className="font-display text-xl leading-[1.2] text-ink">{label}</h3>
        <p className="leading-relaxed text-muted">
          {ART_STYLE_DESCRIPTIONS[style]}
        </p>
      </div>
    </article>
  );
}
