import {
  button,
  creatureObject,
  creatureSubject,
  divider,
  escapeHtml,
  heading,
  paragraph,
  shell,
  type RenderedEmail,
} from "../layout";

/**
 * The three mails around approving a portrait.
 *
 * They are in one file because they are one conversation: here it is, here it
 * is again, it is going to print. Whatever tone one of them takes, the other
 * two have to match.
 *
 * THE RULE ALL THREE KEEP: nothing is written in the future tense about the
 * animal. A share of these orders are placed within a week of a loss, and a
 * line like "we cannot wait to meet them" lands like a slap on the person it
 * finds. What is in the future is the PORTRAIT and the parcel. The creature
 * simply is, or was, and both readings have to work.
 */

export interface ApprovalMailData {
  firstName: string;
  /** The pet's name, if we were given one. */
  creatureName: string | null;
  /** The signed approval link. Grants one approval and no login. */
  approveUrl: string;
}

export function artworkReadyEmail(data: ApprovalMailData): RenderedEmail {
  const subject = creatureSubject(data.creatureName);
  const object = creatureObject(data.creatureName);

  const body = [
    heading("Here they are."),
    paragraph(
      `Hi ${escapeHtml(data.firstName)}, we have drawn ${escapeHtml(object)} and set the plate for your piece.`,
    ),
    paragraph(
      "Have a look at both sides. Nothing goes to the press until you say so, and if the first one is not quite right we will do it again.",
    ),
    button(data.approveUrl, "See the portrait"),
    divider(),
    paragraph(
      "This link is yours alone. It opens your portrait and nothing else about your account.",
    ),
  ].join("\n");

  const text = [
    `Here they are.`,
    ``,
    `Hi ${data.firstName}, we have drawn ${object} and set the plate for`,
    `your piece.`,
    ``,
    `Have a look at both sides. Nothing goes to the press until you say so,`,
    `and if the first one is not quite right we will do it again.`,
    ``,
    `See the portrait:`,
    data.approveUrl,
    ``,
    `Kindred Creatures · Jeffreys Bay, South Africa`,
  ].join("\n");

  return {
    subject: `${subject} is ready to see`,
    html: shell({
      title: `${subject} is ready to see`,
      preheader: "Your portrait is ready. Nothing prints until you say so.",
      body,
    }),
    text,
  };
}

export function revisionReadyEmail(data: ApprovalMailData): RenderedEmail {
  const object = creatureObject(data.creatureName);

  const body = [
    heading("Another look."),
    paragraph(
      `Hi ${escapeHtml(data.firstName)}, we have drawn ${escapeHtml(object)} again with your notes in hand.`,
    ),
    paragraph(
      "Same as before: nothing is printed until you are happy with it.",
    ),
    button(data.approveUrl, "See the new portrait"),
    divider(),
    paragraph(
      "If this one is still not right, tell us again. A person reads every note.",
    ),
  ].join("\n");

  const text = [
    `Another look.`,
    ``,
    `Hi ${data.firstName}, we have drawn ${object} again with your notes`,
    `in hand.`,
    ``,
    `Same as before: nothing is printed until you are happy with it.`,
    ``,
    `See the new portrait:`,
    data.approveUrl,
    ``,
    `If this one is still not right, tell us again. A person reads every note.`,
    ``,
    `Kindred Creatures · Jeffreys Bay, South Africa`,
  ].join("\n");

  return {
    subject: `Another look at ${creatureObject(data.creatureName)}`,
    html: shell({
      title: "Another look",
      preheader: "We have drawn it again with your notes in hand.",
      body,
    }),
    text,
  };
}

export interface ApprovedMailData {
  firstName: string;
  creatureName: string | null;
  /** Short human reference, not the raw uuid. */
  orderRef: string;
  /** The signed order-status link, which is not the approval link. */
  orderUrl: string;
}

export function approvedEmail(data: ApprovedMailData): RenderedEmail {
  const subject = creatureSubject(data.creatureName);

  const body = [
    heading("Off to the press."),
    paragraph(
      `Thank you ${escapeHtml(data.firstName)}. Your piece is being made now, by hand, in Jeffreys Bay.`,
    ),
    paragraph(
      "We will email you the moment it is with the courier. Most orders reach their door within 7 to 10 working days.",
    ),
    button(data.orderUrl, "View your order"),
  ].join("\n");

  const text = [
    `Off to the press.`,
    ``,
    `Thank you ${data.firstName}. Your piece is being made now, by hand,`,
    `in Jeffreys Bay.`,
    ``,
    `We will email you the moment it is with the courier. Most orders reach`,
    `their door within 7 to 10 working days.`,
    ``,
    `View your order:`,
    data.orderUrl,
    ``,
    `Kindred Creatures · Jeffreys Bay, South Africa`,
  ].join("\n");

  return {
    subject: `${subject} is going to print`,
    html: shell({
      title: `${subject} is going to print`,
      preheader: "Your piece is being made now.",
      body,
    }),
    text,
  };
}

export interface DelayedMailData {
  firstName: string;
  creatureName: string | null;
}

/**
 * Sent when a drawing has failed twice and a person is picking it up.
 *
 * A paid order must never go silent. It says less than it knows on purpose:
 * "the model refused" is our problem, not theirs, and what they need is that
 * somebody has it and nothing has been lost.
 */
export function drawingDelayedEmail(data: DelayedMailData): RenderedEmail {
  const object = creatureObject(data.creatureName);

  const body = [
    heading("This one is taking me a little longer."),
    paragraph(
      `Hi ${escapeHtml(data.firstName)}, I am working on ${escapeHtml(object)} by hand rather than letting it go out not quite right.`,
    ),
    paragraph(
      "Your order is safe and nothing has been printed. I will email you the portrait to look at as soon as it is ready, and you can still say no to it then.",
    ),
    divider(),
    paragraph("Reply to this mail if you would like to talk to me about it."),
  ].join("\n");

  const text = [
    `This one is taking me a little longer.`,
    ``,
    `Hi ${data.firstName}, I am working on ${object} by hand rather than`,
    `letting it go out not quite right.`,
    ``,
    `Your order is safe and nothing has been printed. I will email you the`,
    `portrait to look at as soon as it is ready, and you can still say no to`,
    `it then.`,
    ``,
    `Reply to this mail if you would like to talk to me about it.`,
    ``,
    `Kindred Creatures · Jeffreys Bay, South Africa`,
  ].join("\n");

  return {
    subject: `A little longer on ${creatureObject(data.creatureName)}`,
    html: shell({
      title: "Taking a little longer",
      preheader: "Your order is safe and nothing has been printed.",
      body,
    }),
    text,
  };
}
