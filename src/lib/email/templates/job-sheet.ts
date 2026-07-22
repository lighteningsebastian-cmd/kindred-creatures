import {
  COLORS,
  FONT_BODY,
  FONT_DISPLAY,
  escapeHtml,
  shell,
  type RenderedEmail,
} from "../layout";

/**
 * The print shop's copy of an order. This is an operations document, not
 * marketing: the person reading it is standing at a press with the next job
 * queued, and everything they need (what to print, how big, where the file is,
 * where it goes afterwards) has to survive being read in ten seconds or printed
 * onto paper in black and white.
 */

export interface JobSheetLine {
  productName: string;
  color: string;
  size: string;
  qty: number;
  /** Print area from the catalogue, in millimetres. */
  printAreaMm: { widthMm: number; heightMm: number };
  /** Pixel dimensions of the print file, when we know them. */
  printPx?: { widthPx: number; heightPx: number } | null;
  /**
   * Signed, expiring link to the print-res file. Null when the file is not
   * ready yet, which the sheet says out loud rather than showing a dead link.
   */
  printFileUrl?: string | null;
}

export interface JobSheetData {
  /** Short human reference (see orderRef in ../layout), not the raw uuid. */
  orderRef: string;
  /** Formatted order date (see formatOrderDate in ../layout). */
  orderDate: string;
  lines: JobSheetLine[];
  /** Courier label address, one line per element, already formatted. */
  shipTo: string[];
  customerEmail: string;
  /** The number the courier calls on delivery day. The visible fallback when
   *  email cannot reach the customer, so it rides on the ops document too. */
  customerPhone: string;
  /**
   * How long the print-file links stay alive, in hours, purely so the sheet can
   * say so. The links are minted by the caller (see sendJobSheet), which owns
   * the actual TTL.
   */
  linkTtlHours: number;
}

function dimsText(line: JobSheetLine): string {
  const area = `${line.printAreaMm.widthMm} x ${line.printAreaMm.heightMm} mm`;
  if (!line.printPx) return `${area} (print file pixel size not recorded)`;
  return `${area} · file ${line.printPx.widthPx} x ${line.printPx.heightPx} px`;
}

function cell(content: string, extra = ""): string {
  return `<td style="padding:8px 10px;border:1px solid ${COLORS.dune300};font-family:${FONT_BODY};font-size:14px;line-height:1.5;color:${COLORS.bark900};vertical-align:top;${extra}">${content}</td>`;
}

function headCell(label: string): string {
  return `<th align="left" style="padding:8px 10px;border:1px solid ${COLORS.dune300};background-color:${COLORS.parchment100};font-family:${FONT_BODY};font-size:11px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.bark700};">${escapeHtml(label)}</th>`;
}

function lineHtml(line: JobSheetLine, index: number): string {
  const file = line.printFileUrl
    ? `<a href="${escapeHtml(line.printFileUrl)}" style="color:${COLORS.oxblood500};">Download print file</a>`
    : `<span style="color:${COLORS.taupe500};">Not ready yet, we will follow up</span>`;
  return `<tr>
${cell(String(index + 1), "white-space:nowrap;")}
${cell(`<strong>${escapeHtml(line.productName)}</strong><br />${escapeHtml(`${line.color} · ${line.size}`)}`)}
${cell(String(line.qty), "white-space:nowrap;")}
${cell(escapeHtml(dimsText(line)))}
${cell(file)}
</tr>`;
}

export function jobSheetEmail(data: JobSheetData): RenderedEmail {
  const body = [
    `<h1 style="margin:8px 0 4px 0;font-family:${FONT_DISPLAY};font-weight:400;font-size:28px;line-height:1.2;color:${COLORS.bark900};">Print job ${escapeHtml(data.orderRef)}</h1>`,
    `<p style="margin:0 0 20px 0;font-family:${FONT_BODY};font-size:14px;color:${COLORS.taupe500};">Ordered ${escapeHtml(data.orderDate)} · ${escapeHtml(String(data.lines.length))} line(s)</p>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 20px 0;">
  <tr>
${headCell("#")}
${headCell("Item")}
${headCell("Qty")}
${headCell("Print size")}
${headCell("File")}
  </tr>
${data.lines.map(lineHtml).join("\n")}
</table>`,
    `<p style="margin:0 0 20px 0;font-family:${FONT_BODY};font-size:13px;line-height:1.5;color:${COLORS.taupe500};">Download links expire ${escapeHtml(String(data.linkTtlHours))} hours after this mail was sent. If one has lapsed, reply and we will send a fresh link.</p>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
  <tr>
${headCell("Ship to (courier label)")}
  </tr>
  <tr>
${cell(data.shipTo.map((line) => escapeHtml(line)).join("<br />"))}
  </tr>
  <tr>
${cell(`Courier contact (phone): ${escapeHtml(data.customerPhone)}`, `color:${COLORS.bark900};font-size:13px;font-weight:700;`)}
  </tr>
  <tr>
${cell(`Customer email: ${escapeHtml(data.customerEmail)}`, `color:${COLORS.taupe500};font-size:13px;`)}
  </tr>
</table>`,
  ].join("\n");

  const text = [
    `PRINT JOB ${data.orderRef}`,
    `Ordered ${data.orderDate}`,
    ``,
    ...data.lines.flatMap((line, index) => [
      `${index + 1}. ${line.productName} · ${line.color} · ${line.size} · qty ${line.qty}`,
      `   Print size: ${dimsText(line)}`,
      `   File: ${line.printFileUrl ?? "not ready yet, we will follow up"}`,
      ``,
    ]),
    `Download links expire ${data.linkTtlHours} hours after this mail was sent.`,
    `If one has lapsed, reply and we will send a fresh link.`,
    ``,
    `SHIP TO (COURIER LABEL)`,
    ...data.shipTo,
    ``,
    `Courier contact (phone): ${data.customerPhone}`,
    `Customer email: ${data.customerEmail}`,
    ``,
    `Kindred Creatures · Cape Town, South Africa`,
  ].join("\n");

  return {
    subject: `Print job ${data.orderRef} · ${data.lines.length} item(s)`,
    html: shell({
      title: `Print job ${data.orderRef}`,
      preheader: `${data.lines.length} item(s) to print, ordered ${data.orderDate}`,
      body,
      footer: "Operational mail · reply to this address to reach a person.",
    }),
    text,
  };
}
