import {
  COLORS,
  FONT_BODY,
  button,
  divider,
  escapeHtml,
  eyebrow,
  heading,
  paragraph,
  shell,
  type RenderedEmail,
} from "../layout";

export interface WelcomeData {
  /** Absolute link to the shop, built by the caller from the site URL. */
  shopUrl: string;
  /** Absolute, signed unsubscribe link. Also carried as a List-Unsubscribe header. */
  unsubscribeUrl: string;
  /** The POPIA sender-identity line: who we are and where to reach a human. */
  senderIdentity: string;
}

/**
 * The single welcome email, sent the first time an address joins the list (and
 * again if a returned unsubscriber re-subscribes). It is not a receipt and it is
 * not a campaign: it confirms the person is on the list, sets honest expectations
 * about what we will and will not send, points them at the shop, and carries the
 * two things every marketing mail must carry under POPIA: a sender identity and
 * a one-click way out.
 *
 * There is deliberately no discount here. The list's promise is first look at new
 * styles and the occasional story worth reading, not a coupon, so the copy sells
 * that and nothing it cannot keep.
 */
export function welcomeEmail(data: WelcomeData): RenderedEmail {
  const unsubscribeLink = `<a href="${escapeHtml(data.unsubscribeUrl)}" style="color:${COLORS.taupe500};text-decoration:underline;">unsubscribe in one click</a>`;

  const footer = [
    escapeHtml(data.senderIdentity),
    `You are receiving this because you asked us to keep you posted. Changed your mind? You can ${unsubscribeLink} any time.`,
  ].join("<br /><br />");

  const body = [
    eyebrow("You are on the list"),
    heading("Welcome. You will be first to see what we make next."),
    paragraph(
      "Thank you for joining us. Kindred Creatures turns a photo of the animal you love into a hand-printed portrait on things you actually wear and use, printed here in South Africa.",
    ),
    paragraph(
      "Here is what lands in your inbox, and what will not. You will get first look at new styles and colours as we add them, and now and then a story worth reading. That is it. No daily nagging, no noise, and never your details passed to anyone else.",
    ),
    divider(),
    eyebrow("Ready when you are"),
    paragraph(
      "If you already have the photo in mind, the whole thing starts with an upload. Have a look at what we print it on.",
    ),
    button(data.shopUrl, "Browse the shop"),
    divider(),
    paragraph(
      "Anything at all, just reply to this mail and a real person will answer. We would love to meet your creature.",
    ),
  ].join("\n");

  const text = [
    "YOU ARE ON THE LIST",
    "",
    "Welcome. You will be first to see what we make next.",
    "",
    "Thank you for joining us. Kindred Creatures turns a photo of the animal",
    "you love into a hand-printed portrait on things you actually wear and use,",
    "printed here in South Africa.",
    "",
    "Here is what lands in your inbox, and what will not. You will get first",
    "look at new styles and colours as we add them, and now and then a story",
    "worth reading. That is it. No daily nagging, and never your details passed",
    "to anyone else.",
    "",
    "Ready when you are. Browse the shop:",
    data.shopUrl,
    "",
    "Anything at all, just reply to this mail and a real person will answer.",
    "",
    "---",
    data.senderIdentity,
    "",
    "You are receiving this because you asked us to keep you posted.",
    "Unsubscribe in one click any time:",
    data.unsubscribeUrl,
  ].join("\n");

  return {
    subject: "Welcome to Kindred Creatures",
    html: shell({
      title: "Welcome to Kindred Creatures",
      preheader: "You are on the list. First look at new styles, the occasional story.",
      body,
      footer,
    }),
    text,
  };
}
