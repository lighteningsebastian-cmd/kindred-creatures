/**
 * ===========================================================================
 * EVERY WORD WE SAY TO THE PORTRAIT MODEL IS IN THIS FILE. NOTHING ELSE IS.
 * ===========================================================================
 *
 * You do not need to be a programmer to change this file. You are editing
 * pieces of ordinary English, each between the pair of quote marks after an
 * `=` sign. Change the words, leave the quote marks, the `+` signs and the
 * semicolons exactly where they are.
 *
 * THERE ARE TWO PORTRAITS PER GARMENT, NOT THREE STYLES. The customer used to
 * choose between a painted portrait, a line sketch and a watercolour. There is
 * one house style now (owner decision, 3 August), and the two portraits we draw
 * are the two SIDES of the garment:
 *
 *     FRONT   the left-chest patch. Colour, facing the viewer.
 *     BACK    the large plate. Graphite, strict side profile.
 *
 * They are different pictures of the same animal, not different tastes. Each is
 * glued together, in this order, into one instruction:
 *
 *     SUBJECT       what animal to draw and what must stay true to the photo
 *     STYLE         how that side is drawn
 *     COMPOSITION   where the animal sits and which way it faces
 *     CONSTRAINTS   everything the picture must NOT contain
 *
 * SUBJECT and CONSTRAINTS are identical for both. That sameness is what makes
 * the range look like a range.
 *
 * HOW TO MAKE A CHANGE
 *
 *   1. Edit the words.
 *   2. Bump PROMPT_VERSION below (see the note on it).
 *   3. Ask for the change to be reviewed and released like any other change.
 *
 * Step 2 is not optional. Every portrait we draw records the version that drew
 * it, so months from now "the backs went strange in August" is a question with
 * an answer instead of an argument.
 *
 * TWO THINGS THAT COST US MONEY WHEN THEY GO WRONG
 *
 *   - Never ask for a frame, a border, a mount or "museum framing". The model
 *     draws a real picture frame when you do, and we then print that frame
 *     onto a hoodie.
 *   - Never let the CONSTRAINTS clause lose "Transparent background". A
 *     portrait with a solid background prints as a rectangle of colour with an
 *     animal inside it, which is not what anyone bought.
 *
 * These words are a starting hypothesis, not proven fact. They are meant to be
 * revised against real photographs. `docs/spec-portrait-prompting.md` section 6
 * is the testing protocol, and findings belong in that file.
 */

/** Which side of the garment a portrait is being drawn for. */
export type PortraitSide = "front" | "back";

/**
 * Which wording drew a given portrait. Written to `artworks.prompt_version` on
 * every generation.
 *
 * BUMP THIS WHENEVER ANY TEXT BELOW CHANGES. The shape is the date you changed
 * it plus a number for the change within that day: "2026-07-29.1", then
 * "2026-07-29.2", then "2026-08-04.1" and so on. Never reuse an old value: a
 * version that means two different sets of words is worse than no version.
 */
export const PROMPT_VERSION = "2026-08-03.1";

/**
 * Who to draw. This clause exists to stop the model quietly drawing a
 * handsome, generic example of the breed instead of the animal in the photo.
 * The likeness is the product, so if you ever have to choose between this
 * clause and any other, this one wins.
 */
export const SUBJECT =
  "A portrait of THIS SPECIFIC animal from the photograph. Preserve its exact " +
  "markings, coat colour and pattern, ear shape, eye colour and facial structure. " +
  "The likeness must be unmistakable to its owner.";

/**
 * How each side is drawn. Keep these clauses about medium, light and palette
 * only: which way the animal faces belongs in the composition clauses below.
 *
 * The front is the house style, in colour, and it is the one most people will
 * see across a room. The back is graphite because it sits inside an archival
 * plate of typeset rules and data, and colour there would fight the type.
 */
export const STYLE_CLAUSE: Record<PortraitSide, string> = {
  front:
    "Rendered as a warm painterly oil portrait with visible soft brushwork, " +
    "gentle directional light, a muted natural palette.",
  back:
    "Rendered as a fine graphite pencil drawing, monochrome, soft directional " +
    "shading, no colour anywhere.",
};

/**
 * Where the animal sits in the picture, and which way it faces.
 *
 * The generous margin is deliberate on both: the portrait gets resized to each
 * garment's print area, and a subject that runs to the edge of the picture is a
 * subject cropped off the edge of a hoodie.
 *
 * THE BACK MUST BE A TRUE SIDE PROFILE. It is drawn from a face-on photograph,
 * so the profile has to be inferred, which is exactly why the back gets the
 * breed's hand-reviewed reference illustration as a second input. Ask plainly
 * and repeatedly for the profile: a model handed a face-on photo will drift
 * back to face-on given the slightest room, and a three-quarter view in an
 * archival plate reads as a mistake rather than a portrait.
 */
export const COMPOSITION: Record<PortraitSide, string> = {
  front:
    "Head and shoulders, centred, generous even margin around the subject, " +
    "facing the viewer.",
  back:
    "Head and shoulders in strict side profile, facing left, the head turned " +
    "fully to the side so exactly one eye and one side of the muzzle are " +
    "visible. Centred, generous even margin around the subject. Not " +
    "three-quarter view, not facing the viewer.",
};

/**
 * Everything the picture must not contain. Every item on this list is
 * something a model adds on its own when nothing forbids it, and every one of
 * them would be printed onto a garment. Text is the worst of them: image
 * models cannot spell, and a misspelt word on a printed hoodie cannot be
 * recovered.
 */
export const CONSTRAINTS =
  "No background scenery. No frame, no border, no text, no lettering, no signature, " +
  "no watermark, no human hands, no collar tags with writing. " +
  "Transparent background. Suitable for printing on fabric.";

/**
 * What we add to the instruction when a customer tells us what is not right.
 *
 * These are the ONLY words a customer can influence, and they cannot type
 * them: they tick a box, and the box is bound to one of these sentences. What
 * a customer WRITES to us never reaches the model at all. It goes to the admin
 * queue for a person to read. See docs/spec-pipeline.md section 6.
 *
 * That is not caution about rude words. A text box wired to a prompt hands a
 * stranger the controls on something we print and post at our expense.
 *
 * "Something else" is deliberately absent. It means "read my note", which is a
 * job for a human, not for the model.
 */
export const REVISION_ADJUSTMENT: Record<string, string> = {
  "not-like-them":
    "The previous attempt did not look like this animal. Follow the photograph " +
    "far more closely: exact markings, exact proportions, exact face.",
  "wrong-colouring":
    "The previous attempt had the wrong colouring. Match the coat colour, " +
    "pattern and markings in the photograph exactly.",
  "too-dark":
    "The previous attempt was too dark. Lighten the overall tone and open up " +
    "the shadows, keeping the same colours.",
  "too-light":
    "The previous attempt was too light. Deepen the overall tone and give the " +
    "shadows more weight, keeping the same colours.",
  "wrong-angle":
    "The previous attempt had the wrong head angle. Match the pose and angle " +
    "of the head in the photograph.",
};
