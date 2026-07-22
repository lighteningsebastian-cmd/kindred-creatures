# Customer Journey Redesign: "Getting to Know Their Pet"

## Objective
Transform the experience from *"pick a style"* to *"tell us about your pet"* so customers have spent 3 minutes emotionally invested by checkout. Zero API cost increase.

---

## Current vs. Proposed Flow

### Current (3 steps, ~90 seconds)
1. Upload photo
2. Pick style (Classic, Line Sketch, Watercolor)
3. See preview → Regenerate or checkout

### Proposed (5 steps, ~3 minutes, same API calls)
1. **Name**: "What should we call them?"
2. **Photo**: Upload → Auto-crop background
3. **Personality**: "What's one word describes them?" (8 buttons)
4. **Moment**: "Which moment feels most like them?" (8 buttons)
5. **Memory**: "How would you like to remember them?" (6 buttons)
6. Generate preview & checkout

---

## Implementation Plan

### Phase 1: Data Model (1 hour)

**Update database schema** in `/src/lib/db/schema.ts`:

```typescript
export const artworks = pgTable("artworks", {
  // ...existing fields...
  
  // NEW: Customer input for prompt building
  petName: text("pet_name"),              // "Max", "Luna", etc.
  personalityTag: text("personality_tag"), // "goofy", "regal", "chaotic", etc.
  momentTag: text("moment_tag"),           // "sleeping", "running", "beach", etc.
  styleTag: text("style_tag"),             // "timeless", "playful", "modern", etc.
  
  // OLD: Keep for backward compatibility
  style: text("style"), // Still used for fallback
});
```

**No migration needed** — these are optional fields. Old artworks work fine.

---

### Phase 2: Prompt Building (2 hours)

**Create a new prompt builder** in `/src/lib/images/prompt-builder.ts`:

```typescript
import type { ArtStyle } from "./provider";

export type PersonalityTag = 
  | "goofy" | "regal" | "chaotic" | "loving" 
  | "lazy" | "adventurous" | "cool" | "playful";

export type MomentTag = 
  | "sleeping" | "running" | "beach" | "adventure"
  | "cuddles" | "watching-birds" | "guarding" | "treat-time";

export type StyleTag = 
  | "timeless" | "playful" | "modern" | "classic"
  | "adventure" | "minimal";

interface PromptInput {
  petName?: string;
  personality?: PersonalityTag;
  moment?: MomentTag;
  styleTag?: StyleTag;
  petType?: "dog" | "cat" | "other"; // Detect from upload or let user specify
}

const PERSONALITY_PROMPTS: Record<PersonalityTag, string> = {
  goofy: "silly, expressive, full of joy, tongue-out",
  regal: "dignified, composed, noble bearing, serene",
  chaotic: "energetic, wild, dynamic, movement",
  loving: "affectionate, warm eyes, gentle, tender",
  lazy: "relaxed, cozy, lounging, peaceful",
  adventurous: "bold, confident, exploring, spirited",
  cool: "confident, striking, magnetic presence",
  playful: "fun-loving, mischievous, bright-eyed",
};

const MOMENT_PROMPTS: Record<MomentTag, string> = {
  sleeping: "curled up peacefully, dreaming",
  running: "mid-action, joyful motion, outdoor",
  beach: "on beach with sand and waves, summery",
  adventure: "outdoors in nature, hiking setting",
  cuddles: "snuggled close, intimate, cozy together",
  "watching-birds": "alert, focused, watching intently",
  guarding: "protective stance, watchful, strong",
  "treat-time": "excited, food-focused, happy anticipation",
};

const STYLE_PROMPTS: Record<StyleTag, string> = {
  timeless: "classic museum-quality portrait, warm studio lighting, dignified framing",
  playful: "vibrant, fun, bold colors, whimsical energy",
  modern: "contemporary, clean lines, stylized, artistic interpretation",
  classic: "traditional pet portrait, painterly, soft colors",
  adventure: "dynamic action scene, outdoor elements, dramatic lighting",
  minimal: "simple elegant lines, whitespace, modern aesthetic",
};

/**
 * Builds a comprehensive prompt from customer inputs.
 * Gracefully handles missing data (falls back to generic descriptions).
 */
export function buildPrompt(input: PromptInput): string {
  const petType = input.petType ?? "pet";
  const personality = input.personality 
    ? PERSONALITY_PROMPTS[input.personality]
    : "beautiful and expressive";
  const moment = input.moment
    ? MOMENT_PROMPTS[input.moment]
    : "sitting, calm pose";
  const style = input.styleTag
    ? STYLE_PROMPTS[input.styleTag]
    : "warm, classic portrait style, soft lighting";

  // Craft the final prompt
  return `
Create a portrait of ${input.petName ? `a ${petType} named ${input.petName}` : `a ${petType}`} that is ${personality}.
Scene: ${moment}.
Style: ${style}.
Make it feel like a treasured keepsake, capturing their essence and personality.
  `.trim();
}

/**
 * Maps old style-only artworks to new prompt format for backward compatibility.
 */
export function legacyStyleToPrompt(style: ArtStyle): string {
  const styleMap: Record<ArtStyle, string> = {
    "classic-portrait": "warm, painterly classic pet portrait, soft studio lighting, museum framing, dignified pose",
    "line-sketch": "clean single-weight ink line-art sketch of the pet, minimal, on plain background",
    watercolor: "loose, expressive watercolor portrait of the pet, gentle washes, textured paper feel",
  };
  return styleMap[style];
}
```

---

### Phase 3: UI Components (3 hours)

**New component hierarchy:**

```
CustomizerV2.tsx (replaces Customizer.tsx)
├── NameStep.tsx           (Pet name input)
├── PhotoStep.tsx          (Upload + auto-crop)
├── PersonalityStep.tsx    (8 personality buttons)
├── MomentStep.tsx         (8 moment buttons)
├── StyleStep.tsx          (6 memory style buttons)
├── PreviewStep.tsx        (Current PreviewStage)
└── CheckoutStep.tsx       (Add to cart)
```

**Example: PersonalityStep.tsx**

```typescript
"use client";

import { cn } from "@/lib/cn";
import type { PersonalityTag } from "@/lib/images/prompt-builder";

export type PersonalityStepProps = {
  selected: PersonalityTag | null;
  onSelect: (tag: PersonalityTag) => void;
  disabled?: boolean;
};

const PERSONALITIES: { tag: PersonalityTag; emoji: string; label: string }[] = [
  { tag: "goofy", emoji: "🐾", label: "Goofy" },
  { tag: "regal", emoji: "👑", label: "Regal" },
  { tag: "chaotic", emoji: "⚡", label: "Chaotic" },
  { tag: "loving", emoji: "💕", label: "Loving" },
  { tag: "lazy", emoji: "😴", label: "Lazy" },
  { tag: "adventurous", emoji: "🏔️", label: "Adventurous" },
  { tag: "cool", emoji: "😎", label: "Cool" },
  { tag: "playful", emoji: "🎾", label: "Playful" },
];

export function PersonalityStep({
  selected,
  onSelect,
  disabled,
}: PersonalityStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="eyebrow mb-3 text-xs text-muted">
          What's one word that describes them?
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PERSONALITIES.map(({ tag, emoji, label }) => (
            <button
              key={tag}
              type="button"
              disabled={disabled}
              aria-pressed={selected === tag}
              onClick={() => onSelect(tag)}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-md border p-4 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-60",
                selected === tag
                  ? "border-accent bg-accent-tint"
                  : "border-line bg-surface hover:border-line-strong",
              )}
            >
              <span className="text-2xl">{emoji}</span>
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Similar pattern for MomentStep.tsx and StyleStep.tsx** — just swap the options and emoji.

---

### Phase 4: Auto-Crop Background (2–3 hours)

**Option A: RemoveBG API** (easiest, ~$0.50/image)
```typescript
// /src/lib/images/removebg.ts
import fetch from "node-fetch";

export async function removeBg(imageBytes: Uint8Array): Promise<Uint8Array> {
  const formData = new FormData();
  formData.append("image_file", new Blob([imageBytes]), "photo.jpg");
  formData.append("type", "auto");
  formData.append("format", "png");

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-API-Key": process.env.REMOVEBG_API_KEY },
    body: formData,
  });

  if (!response.ok) throw new Error("Remove.bg failed");
  return new Uint8Array(await response.arrayBuffer());
}
```

**Option B: Sharp (local, free)**
```typescript
// Crops to main subject using OpenAI vision + bounding box
// More complex but zero recurring cost
// Use if you want to control costs tightly
```

**Integration point:** After upload succeeds, before showing preview:
```typescript
const cropped = await removeBg(uploadedImageBytes);
// Store both versions, show cropped version immediately
// "Show them their pet. Immediately they're smiling."
```

---

### Phase 5: API Route Updates (2 hours)

**Update `/src/app/api/generate/route.ts`** to accept new fields:

```typescript
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Expected a JSON body.", 400);
  }

  const { 
    artworkId, 
    style,
    // NEW: Optional fields for rich prompts
    petName,
    personalityTag,
    momentTag,
    styleTag,
    petType,
  } = (body ?? {}) as {
    artworkId?: unknown;
    style?: unknown;
    petName?: unknown;
    personalityTag?: unknown;
    momentTag?: unknown;
    styleTag?: unknown;
    petType?: unknown;
  };

  if (typeof artworkId !== "string" || artworkId.length === 0) {
    return bad("artworkId is required.", 400);
  }

  // Backward compatibility: handle old-style requests (style only)
  // OR new-style requests (personality + moment + styleTag)
  
  const db = await getDb();
  const [artwork] = await db
    .select()
    .from(artworks)
    .where(eq(artworks.id, artworkId))
    .limit(1);

  if (!artwork) {
    return bad("We could not find that upload. Please start again.", 404);
  }

  if (artwork.regenCount >= REGEN_CAP) {
    return bad(
      `You have used all ${REGEN_CAP} portrait tries for this photo. Upload a new photo to start over.`,
      429,
    );
  }

  // Store the new fields for future reference
  await db
    .update(artworks)
    .set({ 
      status: "generating", 
      style,
      // NEW
      petName: petName ?? artwork.petName,
      personalityTag: personalityTag ?? artwork.personalityTag,
      momentTag: momentTag ?? artwork.momentTag,
      styleTag: styleTag ?? artwork.styleTag,
    })
    .where(eq(artworks.id, artworkId));

  try {
    const provider = await getImageProvider();
    
    // Build prompt from customer inputs
    const prompt = personalityTag || momentTag || styleTag
      ? buildPrompt({
          petName,
          personality: personalityTag as PersonalityTag,
          moment: momentTag as MomentTag,
          styleTag: styleTag as StyleTag,
          petType: petType as "dog" | "cat" | "other",
        })
      : legacyStyleToPrompt(style as ArtStyle); // Fallback
    
    const { previewBytes } = await provider.generatePreview({
      uploadKey: artwork.uploadKey,
      prompt, // NEW: Pass full prompt instead of style
    });

    // ...rest of existing logic...
  } catch {
    await db
      .update(artworks)
      .set({ status: "failed" })
      .where(eq(artworks.id, artworkId));
    return bad(
      "Something went wrong making that portrait. Please try again.",
      500,
    );
  }
}
```

**Update OpenAI provider** in `/src/lib/images/openai.ts`:

```typescript
export class OpenAIImageProvider implements ImageProvider {
  // ...existing code...

  private async render(
    uploadKey: string,
    prompt: string, // CHANGED: Accept full prompt, not style enum
    size: string,
  ): Promise<Uint8Array> {
    const source = await getStorage().getBytes(uploadKey);
    if (!source) throw new Error(`Upload ${uploadKey} not found`);
    const client = (await this.client()) as any;
    const { toFile } = (await this.sdk()) as any;
    const image = await toFile(source, "upload.png", { type: "image/png" });
    
    const result = await client.images.edit({
      model: "gpt-image-1",
      image,
      prompt: `Turn this pet photo into ${prompt}.`, // Use full prompt
      size,
    });
    
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned from gpt-image-1");
    return new Uint8Array(Buffer.from(b64, "base64"));
  }

  async generatePreview({
    uploadKey,
    prompt,
  }: {
    uploadKey: string;
    prompt: string;
  }): Promise<{ previewBytes: Uint8Array }> {
    return { previewBytes: await this.render(uploadKey, prompt, "1024x1024") };
  }
}
```

---

### Phase 6: State Management (1 hour)

**Update `/src/components/customizer/Customizer.tsx`** to use new flow:

```typescript
type Phase = 
  | "name" 
  | "photo" 
  | "personality" 
  | "moment" 
  | "style" 
  | "generating" 
  | "ready" 
  | "failed";

export function Customizer({ product, color, size, active }: CustomizerProps) {
  const [phase, setPhase] = useState<Phase>("name");
  const [petName, setPetName] = useState<string>("");
  const [personalityTag, setPersonalityTag] = useState<PersonalityTag | null>(null);
  const [momentTag, setMomentTag] = useState<MomentTag | null>(null);
  const [styleTag, setStyleTag] = useState<StyleTag | null>(null);
  
  // ...existing state...

  const handleGenerateClick = async () => {
    if (!artworkId || !personalityTag || !momentTag || !styleTag) return;
    
    setPhase("generating");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artworkId,
          petName,
          personalityTag,
          momentTag,
          styleTag,
          petType: "dog", // Or detect from user input
        }),
      });
      
      // ...handle response...
    } catch {
      setPhase("failed");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {phase === "name" && (
        <NameStep 
          value={petName}
          onChange={setPetName}
          onNext={() => setPhase("photo")}
        />
      )}
      
      {phase === "photo" && (
        <PhotoStep
          onUpload={handleFile}
          onNext={() => setPhase("personality")}
        />
      )}
      
      {phase === "personality" && (
        <PersonalityStep
          selected={personalityTag}
          onSelect={(tag) => {
            setPersonalityTag(tag);
            setPhase("moment");
          }}
        />
      )}
      
      {phase === "moment" && (
        <MomentStep
          selected={momentTag}
          onSelect={(tag) => {
            setMomentTag(tag);
            setPhase("style");
          }}
        />
      )}
      
      {phase === "style" && (
        <StyleStep
          selected={styleTag}
          onSelect={(tag) => {
            setStyleTag(tag);
            handleGenerateClick();
          }}
        />
      )}
      
      {(phase === "generating" || phase === "ready" || phase === "failed") && (
        <PreviewStage {...previewProps} />
      )}
    </div>
  );
}
```

---

## Implementation Timeline

| Phase | Task | Duration | Cost |
|-------|------|----------|------|
| 1 | Database schema update | 1 hour | $0 |
| 2 | Prompt builder logic | 2 hours | $0 |
| 3 | UI components (5 steps) | 3 hours | $0 |
| 4 | Auto-crop background* | 2–3 hours | ~$0.50/image (optional RemoveBG) |
| 5 | API route updates | 2 hours | $0 |
| 6 | State management | 1 hour | $0 |
| **Total** | | **11–12 hours** | **$0–50/month** |

*Auto-crop is optional for MVP. Can skip and show unedited photo initially.

---

## Why This Works (Psychologically)

1. **Naming**: Creates ownership. "Max" is not a pet, it's YOUR pet.
2. **Personality buttons**: No blank text boxes = lower friction. Customers feel "seen."
3. **Moment buttons**: Grounds the portrait in *their* memory of the pet, not a generic image.
4. **"How would you like to remember them?"**: Reframes from "pick a style" to "create a keepsake."
5. **3-minute investment**: By checkout, they've thought about their pet 6+ times. Sunk cognitive cost = higher conversion.

---

## API Cost Impact: Zero

- **Old flow**: 1 API call to generate (or 3 if regenerating)
- **New flow**: 1 API call to generate (or 3 if regenerating)
- **Difference**: The prompt is longer, but same endpoint, same model, same price.

---

## Backward Compatibility

- Old artworks with only `style` still work via `legacyStyleToPrompt()`
- New fields are optional in the database
- Frontend gracefully falls back if customer skips steps

---

## Next Steps

1. **Start with Phase 1 & 2** — DB + prompt builder (2–3 hours, zero UI risk)
2. **Test with mock data** — `npm run dev` with different prompts
3. **Build Phase 3 UI** — One step at a time, testing each
4. **A/B test if possible** — Old vs. new flow on 10% of users
5. **Ship Phase 4** (auto-crop) only if it meaningfully improves the moment

Would you like me to stub out any of these components with working code?
