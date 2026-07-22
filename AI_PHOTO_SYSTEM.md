# Kindred Creatures: AI Photo Generation System

## Overview

The Kindred Creatures app uses OpenAI's `gpt-image-1` model to transform pet photos into custom artwork portraits. The system is designed for a seamless user experience with built-in safety, moderation, and user control through three distinct artistic styles.

---

## How the AI Photo System Works

### 1. **Photo Upload & Moderation** (`/src/app/api/upload/route.ts`)
- User uploads a pet photo through the customizer component
- Photo is downscaled to max 2048px (to manage API costs)
- OpenAI's **omni-moderation-latest** model screens the image for content policy violations
- If rejected, user gets a friendly error: "We could not accept this image. Please choose a clear photo of your pet."
- If approved, the image is stored and assigned an `artworkId` for tracking

**Key code location:** `/src/lib/storage.ts` — handles S3-like storage of uploads

---

### 2. **Style Selection**

Three artistic styles are available, each with a specific prompt:

#### **Classic Portrait**
- **Label:** "Warm, painterly, framed like a keepsake"
- **AI Prompt:** "a warm, painterly classic pet portrait, soft studio lighting, museum framing, dignified pose"
- **Use case:** Traditional, gallery-like aesthetic

#### **Line Sketch**
- **Label:** "Clean single-line ink, quiet and modern"
- **AI Prompt:** "a clean single-weight ink line-art sketch of the pet, minimal, on plain background"
- **Use case:** Minimalist, modern aesthetic

#### **Watercolor**
- **Label:** "Soft washes with a hand-painted feel"
- **AI Prompt:** "a loose, expressive watercolor portrait of the pet, gentle washes, textured paper feel"
- **Use case:** Artistic, impressionistic aesthetic

**Key code location:** `/src/lib/images/openai.ts` lines 11–18 — `STYLE_PROMPT` object

---

### 3. **Portrait Generation** (`/src/app/api/generate/route.ts`)

When a user selects a style:

1. The app calls `POST /api/generate` with:
   ```json
   {
     "artworkId": "artwork-uuid",
     "style": "classic-portrait|line-sketch|watercolor"
   }
   ```

2. OpenAI's `gpt-image-1` model uses the **image edit endpoint** to transform the photo:
   - Input: original pet photo
   - Prompt: style-specific prompt from `STYLE_PROMPT`
   - Size: 1024×1024 for preview
   - Output: watermarked preview image

3. Preview is stored and signed URL returned to the frontend

**Generation caps:**
- Users get **3 tries per photo** to experiment with styles (hard limit: 429 status on 4th attempt)
- Preview carries a watermark (removed on final print after purchase)
- Print-quality images (1536×1536) are generated only after payment

**Key code location:** `/src/lib/images/openai.ts` lines 71–92 — `render()` method

---

## Setting Explicit AI Requests: How to Customize

### Current Implementation (Hardcoded Prompts)

The system currently uses fixed, hardcoded prompts for each style. To modify what the AI does, you have three options:

---

### **Option 1: Edit Existing Style Prompts** (Easiest)

Modify the style prompts directly in `/src/lib/images/openai.ts`:

```typescript
const STYLE_PROMPT: Record<ArtStyle, string> = {
  "classic-portrait": "YOUR NEW PROMPT HERE",
  "line-sketch": "YOUR NEW PROMPT HERE",
  watercolor: "YOUR NEW PROMPT HERE",
};
```

**Example:** If you want classic portraits to be more whimsical:
```typescript
"classic-portrait": "a warm, playful classic pet portrait with soft pastel tones, whimsical pose, magical lighting"
```

**When to use this:** You want to globally change how all users experience a style.

---

### **Option 2: Add New Styles** (Moderate Complexity)

To introduce a new style (e.g., "Modern Pop Art"):

1. **Update the type** in `/src/lib/images/provider.ts`:
   ```typescript
   export type ArtStyle = "classic-portrait" | "line-sketch" | "watercolor" | "pop-art";
   
   export const ART_STYLES: ArtStyle[] = [
     "classic-portrait",
     "line-sketch",
     "watercolor",
     "pop-art",
   ];
   ```

2. **Add labels & descriptions** in `/src/lib/images/provider.ts`:
   ```typescript
   export const ART_STYLE_LABELS: Record<ArtStyle, string> = {
     // ...existing...
     "pop-art": "Pop Art",
   };
   ```

3. **Add content description** in `/src/lib/content.ts`:
   ```typescript
   export const ART_STYLE_DESCRIPTIONS: Record<ArtStyle, string> = {
     // ...existing...
     "pop-art": "Bold, vibrant, comic-book style illustration",
   };
   ```

4. **Add the prompt** in `/src/lib/images/openai.ts`:
   ```typescript
   const STYLE_PROMPT: Record<ArtStyle, string> = {
     // ...existing...
     "pop-art": "a bold, vibrant pop-art portrait of the pet, comic book style, bright neons, dramatic contrasts",
   };
   ```

5. **Add UI sample** in `/src/components/customizer/StylePicker.tsx`:
   ```typescript
   const SAMPLE: Record<ArtStyle, { bg: string; accent: string }> = {
     // ...existing...
     "pop-art": { bg: "#ff00ff", accent: "#00ff00" },
   };
   ```

---

### **Option 3: User-Supplied Prompts** (Advanced)

To let users write their own prompts (instead of picking pre-built styles):

**Architecture changes needed:**

1. **Update the schema** in `/src/lib/db/schema.ts`:
   ```typescript
   export const artworks = pgTable("artworks", {
     // ...existing fields...
     customPrompt: text("custom_prompt"), // NEW: store user's custom prompt
   });
   ```

2. **Update the API** in `/src/app/api/generate/route.ts`:
   ```typescript
   // Accept either a style OR a customPrompt
   const { artworkId, style, customPrompt } = body;
   
   // Pass to provider:
   const prompt = customPrompt || STYLE_PROMPT[style];
   const { previewBytes } = await provider.generatePreview({
     uploadKey: artwork.uploadKey,
     prompt, // NEW: pass custom prompt
   });
   ```

3. **Update the provider interface** in `/src/lib/images/provider.ts`:
   ```typescript
   export interface ImageProvider {
     generatePreview(input: {
       uploadKey: string;
       prompt: string; // Changed from style-based
     }): Promise<{ previewBytes: Uint8Array }>;
   }
   ```

4. **Update OpenAI implementation** in `/src/lib/images/openai.ts`:
   ```typescript
   async generatePreview({
     uploadKey,
     prompt, // NEW
   }: {
     uploadKey: string;
     prompt: string;
   }): Promise<{ previewBytes: Uint8Array }> {
     return { previewBytes: await this.render(uploadKey, prompt, "1024x1024") };
   }
   ```

5. **Add UI** in `/src/components/customizer/Customizer.tsx`:
   - Add a text area for custom prompts
   - Validate length (OpenAI has token limits)
   - Pass to `/api/generate` when user submits

---

## Prompt Engineering Best Practices

When writing or editing prompts, follow these principles:

### **What Works Well**
- **Specific visual styles:** "watercolor", "oil painting", "pencil sketch"
- **Mood/tone:** "whimsical", "dignified", "playful", "serene"
- **Composition:** "full body", "close-up face", "tilted head"
- **Lighting:** "soft studio lighting", "natural window light", "dramatic shadows"
- **Medium details:** "textured paper", "bold lines", "vibrant colors"

### **What to Avoid**
- **Vague requests:** "make it nice" → instead: "warm, painterly style"
- **Overly complex:** Prompts >100 words often yield worse results
- **Contradictions:** "minimal detail" AND "hyper-realistic" → pick one
- **Copyrighted styles:** "in the style of Picasso" → use descriptive words instead

### **Example Prompt Formula**
```
"a [mood] [medium] [style] portrait of the [animal], 
[composition], [lighting], [specific detail]"
```

Example:
```
"a whimsical ink-line sketch portrait of the cat, 
sitting pose, facing camera, minimal background, clean single-weight lines"
```

---

## File Structure Summary

```
src/
├── lib/
│   ├── images/
│   │   ├── provider.ts          ← Style definitions & interface
│   │   └── openai.ts            ← STYLE_PROMPT, render logic
│   └── content.ts               ← User-facing descriptions
├── app/
│   ├── api/
│   │   ├── upload/route.ts      ← Moderation endpoint
│   │   └── generate/route.ts    ← Generation endpoint
│   └── products/[slug]/page.ts  ← Main entry point
└── components/
    └── customizer/
        ├── Customizer.tsx       ← State management
        ├── StylePicker.tsx      ← Style selector UI
        └── PreviewStage.tsx     ← Preview display & regenerate button
```

---

## Key Constraints & Limits

| Aspect | Limit | Notes |
|--------|-------|-------|
| **Tries per photo** | 3 | Regenerate/restyle up to 3 times |
| **Photo resolution** | 1024×1024 (preview) | Downscaled from upload for efficiency |
| **Print resolution** | 1536×1536 | Generated after payment |
| **Moderation model** | omni-moderation-latest | Screens for policy violations |
| **Generation model** | gpt-image-1 | OpenAI's latest image model |
| **Preview TTL** | 1 hour | Signed S3 URLs expire after 1 hour |

---

## Implementation Roadmap

If you want to experiment with explicit user control over prompts:

### **Phase 1: Quick Win (1 hour)**
- Edit the three `STYLE_PROMPT` values to test different prompts
- Deploy and gather user feedback
- Iterate on language

### **Phase 2: Add Styles (2–3 hours)**
- Add 1–2 new hardcoded styles (e.g., "Modern Art", "Comic Book")
- Update UI to show the new options
- Test with real photos

### **Phase 3: User Prompts (4–6 hours)**
- Add database migration for `customPrompt` field
- Add text input UI for custom prompts
- Validate prompt length & content
- Update API to accept both style-based and custom prompts
- Consider rate limiting on custom prompt generation

---

## Testing Changes

After editing prompts, test locally:

```bash
npm run dev
```

1. Upload a test photo on `http://localhost:3000`
2. Try each style to see the new prompts in action
3. Compare results with old prompts

**Note:** Requires valid `OPENAI_API_KEY` in `.env.local` to test real generation.

---

## Questions?

- **Moderation too strict?** Adjust the checks in `/src/app/api/upload/route.ts`
- **Want to log prompts sent to OpenAI?** Add logging in `/src/lib/images/openai.ts` line 86
- **Need to track which prompt was used?** Store it in `artworks.style` (already done) or add `customPrompt` field to schema
