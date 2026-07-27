import { formatZar } from "@/lib/products";
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

/** One garment on the order, already resolved from its order_items row. */
export interface ConfirmationLine {
  productName: string;
  color: string;
  size: string;
  qty: number;
  unitPriceZar: number;
}

export interface OrderConfirmationData {
  firstName: string;
  /** Short human reference (see orderRef in ../layout), not the raw uuid. */
  orderRef: string;
  lines: ConfirmationLine[];
  subtotalZar: number;
  shippingZar: number;
  totalZar: number;
  /** The signed order-status link. Built by the caller from the order token. */
  orderUrl: string;
}

function lineText(line: ConfirmationLine): string {
  const parts = [line.productName, line.color, line.size, `x${line.qty}`];
  return `${parts.join(" · ")}   ${formatZar(line.unitPriceZar * line.qty)}`;
}

function lineHtml(line: ConfirmationLine): string {
  const meta = escapeHtml([line.color, line.size, `x${line.qty}`].join(" · "));
  return `<tr>
  <td style="padding:10px 0;border-bottom:1px solid ${COLORS.dune200};font-family:${FONT_BODY};font-size:16px;line-height:1.5;color:${COLORS.bark900};">
    ${escapeHtml(line.productName)}<br />
    <span style="font-size:13px;color:${COLORS.taupe500};">${meta}</span>
  </td>
  <td align="right" style="padding:10px 0;border-bottom:1px solid ${COLORS.dune200};font-family:${FONT_BODY};font-size:16px;color:${COLORS.bark900};white-space:nowrap;">
    ${escapeHtml(formatZar(line.unitPriceZar * line.qty))}
  </td>
</tr>`;
}

function totalRow(label: string, value: string, strong = false): string {
  const weight = strong ? "font-weight:600;" : "";
  const size = strong ? "17px" : "15px";
  const color = strong ? COLORS.bark900 : COLORS.taupe500;
  return `<tr>
  <td style="padding:4px 0;font-family:${FONT_BODY};font-size:${size};${weight}color:${color};">${escapeHtml(label)}</td>
  <td align="right" style="padding:4px 0;font-family:${FONT_BODY};font-size:${size};${weight}color:${color};white-space:nowrap;">${escapeHtml(value)}</td>
</tr>`;
}

/**
 * The first thing a customer gets after paying. It has one job beyond the
 * receipt: tell them what happens now, because they have just paid for a thing
 * that does not exist yet and a week or more of silence is where the support
 * mail comes from.
 */
export function orderConfirmationEmail(
  data: OrderConfirmationData,
): RenderedEmail {
  const shipping =
    data.shippingZar === 0 ? "Free" : formatZar(data.shippingZar);

  const body = [
    heading("Thank you, your portrait is on its way to print."),
    paragraph(
      `Hi ${escapeHtml(data.firstName)}, we have your order and your payment came through. Here is what you ordered and what happens next.`,
    ),
    eyebrow(`Order ${data.orderRef}`),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;">
${data.lines.map(lineHtml).join("\n")}
</table>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0 0;">
${totalRow("Subtotal", formatZar(data.subtotalZar))}
${totalRow("Shipping", shipping)}
${totalRow("Total paid", formatZar(data.totalZar), true)}
</table>`,
    divider(),
    eyebrow("What happens next"),
    paragraph(
      "Your portrait goes to our print shop in Jeffreys Bay, who print it by hand onto your garment. Allow 7 to 10 working days for printing and courier. When it leaves the shop we will send you the tracking number so you can watch it come to you.",
    ),
    paragraph(
      "You can check on your order any time using the link below. Keep it somewhere safe: it is the key to your order page.",
    ),
    button(data.orderUrl, "View your order"),
    divider(),
    paragraph(
      `Anything at all, just reply to this mail and a person will answer. We would love to see your creature wearing it, too.`,
    ),
  ].join("\n");

  const text = [
    `Thank you, your portrait is on its way to print.`,
    ``,
    `Hi ${data.firstName}, we have your order and your payment came through.`,
    ``,
    `ORDER ${data.orderRef}`,
    ...data.lines.map(lineText),
    ``,
    `Subtotal: ${formatZar(data.subtotalZar)}`,
    `Shipping: ${shipping}`,
    `Total paid: ${formatZar(data.totalZar)}`,
    ``,
    `WHAT HAPPENS NEXT`,
    `Your portrait goes to our print shop in Jeffreys Bay, who print it by hand`,
    `onto your garment. Allow 7 to 10 working days for printing and courier.`,
    `When it leaves the shop we will send you the tracking number.`,
    ``,
    `Check on your order any time:`,
    data.orderUrl,
    ``,
    `Anything at all, just reply to this mail and a person will answer.`,
    ``,
    `Kindred Creatures · Jeffreys Bay, South Africa`,
  ].join("\n");

  return {
    subject: `Your Kindred Creatures order ${data.orderRef}`,
    html: shell({
      title: `Order ${data.orderRef}`,
      preheader: `We have your order and your portrait is heading to the print shop.`,
      body,
    }),
    text,
  };
}
