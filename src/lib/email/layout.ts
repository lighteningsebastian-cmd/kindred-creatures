/**
 * Shared pieces every template leans on: the brand palette as hex, an HTML
 * escaper, and the table shell an email actually has to be built out of.
 *
 * Email HTML is not web HTML. There is no cascade worth trusting, no external
 * stylesheet, and Outlook still lays out with tables. So: tables for structure,
 * every style inline, and nothing from Tailwind or globals.css comes near this
 * file.
 *
 * COLOUR. design/DESIGN-SYSTEM.md defines the palette in OKLCH, which mail
 * clients do not support. The hexes below are sRGB conversions of those exact
 * tokens (computed once, rounded to 8-bit), so the emails sit in the same brand
 * as the site without importing anything from it. If a token moves in the
 * design system, reconvert it here; nothing recomputes these automatically.
 */

/** Hex conversions of the OKLCH design tokens. Comment shows the source token. */
export const COLORS = {
  parchment0: "#eeece9", // oklch(94.5% 0.005 80)  page background
  parchment50: "#e7e4e0", // oklch(92%   0.006 78)  card surface
  parchment100: "#dcd8d3", // oklch(88.5% 0.008 76)  subtle fill
  dune200: "#c8c3bd", // oklch(82%   0.010 75)  borders, dividers
  dune300: "#ada7a0", // oklch(73%   0.012 72)  stronger borders
  taupe500: "#5e564f", // oklch(46%   0.015 65)  secondary text
  bark700: "#44382d", // oklch(35%   0.024 65)  headings on light
  bark900: "#241b13", // oklch(23%   0.020 60)  primary ink
  oxblood500: "#802e2b", // oklch(42%   0.115 25)  primary accent
  oxblood100: "#f2d7d4", // oklch(90%   0.030 25)  accent tint
  maroon900: "#351311", // oklch(24%   0.055 25)  inverse band
  camel500: "#a6834b", // oklch(63%   0.085 78)  secondary accent
} as const;

/**
 * Young Serif and Archivo are webfonts. Mail clients mostly will not load them,
 * so each stack ends in something every machine already has, and the layout is
 * sized to survive the fallback rather than assume the webfont.
 */
export const FONT_DISPLAY = "'Young Serif', 'Iowan Old Style', Georgia, serif";
export const FONT_BODY = "Archivo, 'Helvetica Neue', Arial, sans-serif";

/** The utility-bar line from the site chrome. The middot is brand, not a dash. */
export const UTILITY_LINE = "DESIGNED AND PRINTED IN SOUTH AFRICA";

/**
 * Escapes text for HTML. Every interpolation into an email body goes through
 * this: a customer's surname or a pet's name is attacker-controlled text as far
 * as this module is concerned, and an apostrophe in "O'Brien" should not be
 * able to break a table cell either.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The human-facing reference for an order: the first block of its uuid, upper
 * case. Short enough to read down a phone to the print shop, and it reveals no
 * more than the order link the same email already carries.
 */
export function orderRef(orderId: string): string {
  return orderId.split("-")[0].toUpperCase();
}

/** The date line on customer and print-shop mail, in SA order: 17 July 2026. */
export function formatOrderDate(date: Date): string {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Johannesburg",
  }).format(date);
}

/** A postal address as its lines, empty parts dropped. Shared by all templates. */
export function addressLines(address: {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string | null;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
  phone?: string;
}): string[] {
  const lines = [
    `${address.firstName} ${address.lastName}`.trim(),
    address.addressLine1,
    address.addressLine2 ?? "",
    address.suburb,
    `${address.city}, ${address.province}`,
    address.postalCode,
    address.phone ?? "",
  ];
  return lines.map((line) => line.trim()).filter((line) => line !== "");
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Wraps body markup in the outer shell: a centred, fixed-width table on the
 * parchment page colour, a maroon utility band at the top and a quiet footer.
 * `preheader` is the grey line a client shows next to the subject in the
 * inbox list; hiding it in the body is the only way to control it.
 */
export function shell(options: {
  title: string;
  preheader: string;
  body: string;
  footer?: string;
}): string {
  const { title, preheader, body, footer } = options;
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.parchment0};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${COLORS.parchment0};">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.parchment0};">
  <tr>
    <td align="center" style="padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.maroon900};">
        <tr>
          <td align="center" style="padding:10px 16px;font-family:${FONT_BODY};font-size:11px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.parchment0};">
            ${escapeHtml(UTILITY_LINE)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:24px 12px 32px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:${COLORS.parchment50};border:1px solid ${COLORS.dune200};border-radius:6px;">
        <tr>
          <td style="padding:28px 32px 8px 32px;font-family:${FONT_DISPLAY};font-size:24px;line-height:1.25;color:${COLORS.bark900};">
            Kindred Creatures
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px 32px;">
${body}
          </td>
        </tr>
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
        <tr>
          <td align="center" style="padding:16px 32px 0 32px;font-family:${FONT_BODY};font-size:12.5px;line-height:1.5;color:${COLORS.taupe500};">
            ${footer ?? "Kindred Creatures · Jeffreys Bay, South Africa"}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** An Archivo-900 uppercase eyebrow, the brand's section marker. */
export function eyebrow(text: string): string {
  return `<p style="margin:24px 0 8px 0;font-family:${FONT_BODY};font-size:11px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.oxblood500};">${escapeHtml(text)}</p>`;
}

/** Body copy at body-md. */
export function paragraph(text: string): string {
  return `<p style="margin:0 0 14px 0;font-family:${FONT_BODY};font-size:16px;line-height:1.6;color:${COLORS.bark900};">${text}</p>`;
}

/** A display headline. */
export function heading(text: string): string {
  return `<h1 style="margin:8px 0 16px 0;font-family:${FONT_DISPLAY};font-weight:400;font-size:32px;line-height:1.16;color:${COLORS.bark900};">${escapeHtml(text)}</h1>`;
}

/**
 * The primary button. Mail clients ignore <button> and half of them ignore
 * padding on <a>, so this is a one-cell table with the padding on the cell.
 */
export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px 0;">
  <tr>
    <td align="center" style="background-color:${COLORS.oxblood500};border-radius:4px;">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 22px;font-family:${FONT_BODY};font-size:13px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.parchment0};text-decoration:none;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

/** A hairline divider. */
export function divider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;"><tr><td style="border-top:1px solid ${COLORS.dune200};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}
