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

export interface ShippingNotificationData {
  firstName: string;
  /** Short human reference (see orderRef in ../layout), not the raw uuid. */
  orderRef: string;
  /** The courier waybill. Required: this mail has no reason to exist without it. */
  trackingNumber: string;
  /** The signed order-status link. Built by the caller from the order token. */
  orderUrl: string;
}

/**
 * Sent the moment fulfilment puts a waybill on the order. Short by design: the
 * customer opened this for one number, so the number is the loudest thing in it
 * and it is selectable text in both halves, not an image.
 */
export function shippingNotificationEmail(
  data: ShippingNotificationData,
): RenderedEmail {
  const body = [
    heading("Your order is on its way."),
    paragraph(
      `Hi ${escapeHtml(data.firstName)}, your order ${escapeHtml(data.orderRef)} left our Cape Town print shop today and is with the courier.`,
    ),
    eyebrow("Tracking number"),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
  <tr>
    <td style="padding:14px 16px;background-color:${COLORS.parchment100};border:1px solid ${COLORS.dune200};border-radius:4px;font-family:${FONT_BODY};font-size:20px;font-weight:900;letter-spacing:0.06em;color:${COLORS.bark900};">
      ${escapeHtml(data.trackingNumber)}
    </td>
  </tr>
</table>`,
    paragraph(
      "The courier updates their tracking once the parcel is scanned at their depot, so give it until the end of the day to show anything. Someone will need to sign for it.",
    ),
    button(data.orderUrl, "View your order"),
    divider(),
    paragraph(
      "When it arrives, we hope it is exactly the creature you know. Reply to this mail if anything is not right and a person will sort it out.",
    ),
  ].join("\n");

  const text = [
    `Your order is on its way.`,
    ``,
    `Hi ${data.firstName}, your order ${data.orderRef} left our Cape Town`,
    `print shop today and is with the courier.`,
    ``,
    `TRACKING NUMBER: ${data.trackingNumber}`,
    ``,
    `The courier updates their tracking once the parcel is scanned at their`,
    `depot, so give it until the end of the day to show anything. Someone will`,
    `need to sign for it.`,
    ``,
    `View your order:`,
    data.orderUrl,
    ``,
    `Reply to this mail if anything is not right and a person will sort it out.`,
    ``,
    `Kindred Creatures · Cape Town, South Africa`,
  ].join("\n");

  return {
    subject: `Your Kindred Creatures order ${data.orderRef} has shipped`,
    html: shell({
      title: `Order ${data.orderRef} has shipped`,
      preheader: `Tracking number ${data.trackingNumber}`,
      body,
    }),
    text,
  };
}
