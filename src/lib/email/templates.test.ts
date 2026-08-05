// @vitest-environment node
import { describe, it, expect } from "vitest";
import { formatZar, getProduct, printPixels } from "@/lib/products";
import { orderRef } from "./layout";
import { orderConfirmationEmail } from "./templates/order-confirmation";
import { shippingNotificationEmail } from "./templates/shipping-notification";
import { jobSheetEmail } from "./templates/job-sheet";

const ORDER_ID = "4f2a1c0d-1111-2222-3333-444455556666";
const REF = orderRef(ORDER_ID); // "4F2A1C0D"

const HOODIE = getProduct("hoodie")!;
const TEE = getProduct("tee")!;

const CONFIRMATION = {
  firstName: "Thandi",
  orderRef: REF,
  lines: [
    {
      productName: HOODIE.name,
      color: "Charcoal",
      size: "L",
      qty: 2,
      unitPriceZar: 899,
    },
    {
      productName: TEE.name,
      color: "Ecru",
      size: "M",
      qty: 1,
      unitPriceZar: 449,
    },
  ],
  subtotalZar: 2247,
  shippingZar: 0,
  totalZar: 2247,
  orderUrl: `https://kindredcreatures.co.za/order/${ORDER_ID}.abc123signature`,
};

/**
 * No visible copy in this brand may carry an em or en dash (U+2013, U+2014).
 * They are written as escapes below so this guard does not itself trip the
 * repo-wide grep that hunts for them. The middot is brand, and is not matched.
 */
function expectNoDashes(rendered: { subject: string; html: string; text: string }) {
  for (const part of [rendered.subject, rendered.html, rendered.text]) {
    expect(part).not.toMatch(/[\u2013\u2014]/);
  }
}

describe("order confirmation", () => {
  const rendered = orderConfirmationEmail(CONFIRMATION);

  it("renders both halves", () => {
    expect(rendered.html).toContain("<html");
    expect(rendered.text.length).toBeGreaterThan(200);
    expect(rendered.text).not.toContain("<");
  });

  it("carries the order reference in the subject and both bodies", () => {
    expect(rendered.subject).toContain(REF);
    expect(rendered.html).toContain(REF);
    expect(rendered.text).toContain(REF);
  });

  it("lists every line with colour, size and quantity", () => {
    for (const body of [rendered.html, rendered.text]) {
      expect(body).toContain(HOODIE.name);
      expect(body).toContain("Charcoal");
      expect(body).toContain("L");
      expect(body).toContain(TEE.name);
      expect(body).toContain("Ecru");
    }
    expect(rendered.text).toContain("x2");
  });

  it("prices lines and totals in rands via formatZar", () => {
    // Line total is unit price times quantity, not the unit price.
    for (const body of [rendered.html, rendered.text]) {
      expect(body).toContain(formatZar(899 * 2)); // "R 1 798"
      expect(body).toContain(formatZar(449));
      expect(body).toContain(formatZar(2247)); // "R 2 247"
    }
  });

  it("says free rather than R 0 when shipping is free", () => {
    expect(rendered.text).toContain("Shipping: Free");
    expect(rendered.html).toContain("Free");
  });

  it("prices real shipping when it is charged", () => {
    const paid = orderConfirmationEmail({ ...CONFIRMATION, shippingZar: 95 });
    expect(paid.text).toContain(`Shipping: ${formatZar(95)}`);
  });

  it("links to the order status page in both halves", () => {
    expect(rendered.html).toContain(`href="${CONFIRMATION.orderUrl}"`);
    expect(rendered.text).toContain(CONFIRMATION.orderUrl);
  });

  it("leaks no internal id the token does not already carry", () => {
    // The order uuid lives inside the token in the link, so the link is fine.
    // What must not appear is a bare uuid, an artwork id or a storage key.
    const withoutLink = rendered.html.split(CONFIRMATION.orderUrl).join("");
    expect(withoutLink).not.toContain(ORDER_ID);
    expect(rendered.text.split(CONFIRMATION.orderUrl).join("")).not.toContain(
      ORDER_ID,
    );
  });

  it("tells the customer what happens next", () => {
    expect(rendered.text).toContain("Jeffreys Bay");
    expect(rendered.text).toContain("7 to 10 working days");
    expect(rendered.text).toContain("tracking number");
  });

  // The order this mail describes has NOT been printed and has not been sent
  // anywhere: generation happens after payment and an approval mail follows
  // this one. Promising the press here is the one lie that costs the
  // relationship, so it is asserted rather than left to a reviewer's eye.
  it("promises the approval step and never the press", () => {
    // The plain-text half is hard-wrapped, so a sentence spans lines. Compare
    // on whitespace-collapsed copies or the wrapping decides the assertion.
    const flat = (s: string) => s.replace(/\s+/g, " ");
    for (const body of [flat(rendered.html), flat(rendered.text)]) {
      // The exact sentence approval.ts keeps. One promise, one wording.
      expect(body).toContain("othing is printed until you are happy with it");
      expect(body).toContain("second email");
      for (const lie of [
        "off to be printed",
        "on its way to print",
        "heading to the print shop",
      ]) {
        expect(body).not.toContain(lie);
      }
    }
  });

  it("uses no em or en dashes", () => {
    expectNoDashes(rendered);
  });
});

describe("shipping notification", () => {
  const rendered = shippingNotificationEmail({
    firstName: "Thandi",
    orderRef: REF,
    trackingNumber: "AR12345678ZA",
    orderUrl: CONFIRMATION.orderUrl,
  });

  it("puts the tracking number in the subject line's mail and both halves", () => {
    expect(rendered.subject).toContain(REF);
    expect(rendered.html).toContain("AR12345678ZA");
    expect(rendered.text).toContain("AR12345678ZA");
  });

  it("names the customer and links the order", () => {
    expect(rendered.text).toContain("Thandi");
    expect(rendered.text).toContain(CONFIRMATION.orderUrl);
  });

  it("degrades to readable plain text", () => {
    expect(rendered.text).not.toContain("<");
    expect(rendered.text).toContain("TRACKING NUMBER: AR12345678ZA");
  });

  it("uses no em or en dashes", () => {
    expectNoDashes(rendered);
  });
});

describe("job sheet", () => {
  const printUrl =
    "https://kindredcreatures.co.za/api/asset/prints/abc.png?exp=1&sig=deadbeef";
  const rendered = jobSheetEmail({
    orderRef: REF,
    orderDate: "17 July 2026",
    lines: [
      {
        productName: HOODIE.name,
        color: "Charcoal",
        size: "L",
        qty: 2,
        printAreaMm: HOODIE.printArea,
        printPx: printPixels(HOODIE, "back"),
        printFileUrl: printUrl,
      },
    ],
    shipTo: [
      "Thandi Mokoena",
      "12 Kloof Street",
      "Gardens",
      "Cape Town, Western Cape",
      "8001",
    ],
    customerEmail: "thandi@example.test",
    customerPhone: "0821234567",
    linkTtlHours: 168,
  });

  it("headlines the order reference and date", () => {
    expect(rendered.subject).toContain(REF);
    expect(rendered.html).toContain(REF);
    expect(rendered.text).toContain(REF);
    expect(rendered.text).toContain("17 July 2026");
  });

  it("gives the print shop the line, the quantity and the sizes", () => {
    for (const body of [rendered.html, rendered.text]) {
      expect(body).toContain(HOODIE.name);
      expect(body).toContain("Charcoal");
      // Print area in mm and the file's pixel dimensions at 300 DPI.
      expect(body).toContain("280 x 350 mm");
      expect(body).toContain("3307 x 4134 px");
    }
    expect(rendered.text).toContain("qty 2");
  });

  it("states BOTH print areas, because the garment carries two prints", () => {
    // The sheet quoted one measurement, which was the back's, so the left-chest
    // patch had no stated size on the only document the printer works from.
    for (const body of [rendered.html, rendered.text]) {
      expect(body).toContain("280 x 350 mm");
      expect(body).toContain("110 x 150 mm");
    }
  });

  it("carries the signed print-file link", () => {
    // The href is HTML-escaped, so the ampersand between the query parameters
    // arrives as &amp;. That is correct markup and clients unescape it back to
    // the URL the storage layer signed.
    expect(rendered.html).toContain(printUrl.replace(/&/g, "&amp;"));
    expect(rendered.text).toContain(printUrl);
  });

  it("says when the links expire, so a stale sheet is obvious", () => {
    expect(rendered.text).toContain("168 hours");
    expect(rendered.html).toContain("168");
  });

  it("says so plainly when a print file is not ready", () => {
    const pending = jobSheetEmail({
      orderRef: REF,
      orderDate: "17 July 2026",
      lines: [
        {
          productName: TEE.name,
          color: "Stone",
          size: "M",
          qty: 1,
          printAreaMm: TEE.printArea,
          printPx: null,
          printFileUrl: null,
        },
      ],
      shipTo: ["Thandi Mokoena", "8001"],
      customerEmail: "thandi@example.test",
      customerPhone: "0821234567",
      linkTtlHours: 168,
    });
    expect(pending.text).toContain("not ready yet");
    expect(pending.text).toContain("pixel size not recorded");
  });

  it("carries the full shipping address for the courier label", () => {
    for (const body of [rendered.html, rendered.text]) {
      expect(body).toContain("Thandi Mokoena");
      expect(body).toContain("12 Kloof Street");
      expect(body).toContain("Gardens");
      expect(body).toContain("Cape Town, Western Cape");
      expect(body).toContain("8001");
    }
  });

  it("gives the courier a phone number to call on delivery day", () => {
    for (const body of [rendered.html, rendered.text]) {
      expect(body).toContain("Courier contact (phone):");
      expect(body).toContain("0821234567");
    }
  });

  it("uses no em or en dashes", () => {
    expectNoDashes(rendered);
  });
});
