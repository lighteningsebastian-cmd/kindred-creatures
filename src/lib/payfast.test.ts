// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ITEM_NAME,
  buildPaymentFields,
  buildSignature,
  payfastProcessUrl,
  redactFields,
  toAmountString,
  usingMockPayfast,
  verifyItnSignature,
  type PayfastConfig,
} from "./payfast";

/**
 * The signature vectors below are hardcoded, not computed from the module. The
 * base string each one hashes is written out in the comment above it, so if the
 * field order or the encoding ever drifts, these fail loudly and say what the
 * old string was. Recomputing the expectation with the implementation would
 * make that regression invisible, which is the whole point of a fixed vector.
 */

const CONFIG: PayfastConfig = {
  merchantId: "10000100",
  merchantKey: "46f0cd694581a",
  siteUrl: "https://kindredcreature.co.za",
};

const PASSPHRASE = "jt7NOE43FZPn";

/**
 * A fixed token rather than a real signOrderToken() one: the vectors below hash
 * the return URL it is embedded in, so a fixture that changed with
 * ORDER_TOKEN_SECRET would make them unreproducible.
 */
const RETURN_TOKEN = "11111111-1111-1111-1111-111111111111.dGVzdC10b2tlbg";

const ORDER = {
  orderId: "11111111-1111-1111-1111-111111111111",
  firstName: "Thandi",
  lastName: "Mokoena",
  email: "thandi@example.co.za",
  totalZar: 899,
  returnToken: RETURN_TOKEN,
};

/** The payload as it goes over the wire, minus the signature that covers it. */
function withoutSignature(fields: Record<string, string>): Record<string, string> {
  const copy = { ...fields };
  delete copy.signature;
  return copy;
}

describe("toAmountString", () => {
  it("turns whole rands into PayFast's R.CC", () => {
    expect(toAmountString(899)).toBe("899.00");
    expect(toAmountString(0)).toBe("0.00");
    expect(toAmountString(1798)).toBe("1798.00");
  });

  it("refuses a total that is not a number of rands", () => {
    expect(() => toAmountString(Number.NaN)).toThrow(TypeError);
    expect(() => toAmountString(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });
});

describe("buildSignature", () => {
  it("matches a fixed vector with no passphrase", () => {
    // merchant_id=10000100&merchant_key=46f0cd694581a&return_url=https%3A%2F%2F
    // kindredcreature.co.za%2Forder%2F11111111-1111-1111-1111-111111111111.
    // dGVzdC10b2tlbg&cancel_url=...%2Fcheckout%2Fcancelled&notify_url=...%2Fapi
    // %2Fpayfast%2Fnotify&name_first=Thandi&name_last=Mokoena&email_address=
    // thandi%40example.co.za&m_payment_id=1111...&amount=899.00&item_name=
    // Kindred+Creatures+order
    //
    // Note what the token does NOT do to the base string: its dots and dashes
    // ride through unescaped, because PHP's urlencode() leaves - _ . alone.
    // (Vector rolled once, in S5: return_url moved from /checkout/complete to
    // the tokenised /order/<token> so PayFast returns the customer to their own
    // order. The old vector was 589ddebdc5c8bfd40d105e39918bac1a.)
    const fields = buildPaymentFields(ORDER, CONFIG);
    const { signature, ...signed } = fields;
    expect(buildSignature(signed)).toBe("7ff5d7d775d62c4e1255a37df84a3f24");
    expect(signature).toBe("7ff5d7d775d62c4e1255a37df84a3f24");
  });

  it("matches a fixed vector with a passphrase appended last", () => {
    // ...the same base string, then &passphrase=jt7NOE43FZPn
    // (Old vector, pre-token return_url: 397522cc24819eee6789f490316c7acf.)
    const signed = withoutSignature(buildPaymentFields(ORDER, CONFIG));
    expect(buildSignature(signed, PASSPHRASE)).toBe(
      "5a0b2f7bd58a4ad2e8a2efcb639d14e6",
    );
  });

  it("signs a different value with and without a passphrase", () => {
    const signed = withoutSignature(buildPaymentFields(ORDER, CONFIG));
    expect(buildSignature(signed)).not.toBe(buildSignature(signed, PASSPHRASE));
  });

  it("treats a blank passphrase as no passphrase", () => {
    const fields = { amount: "899.00" };
    expect(buildSignature(fields, "")).toBe(buildSignature(fields));
    expect(buildSignature(fields, "   ")).toBe(buildSignature(fields));
  });

  it("encodes spaces as + and & as %26", () => {
    // item_name=Tea+%26+Toast
    expect(buildSignature({ item_name: "Tea & Toast" })).toBe(
      "5a5f091f85695a959cf78ef6a3a68cf4",
    );
  });

  it("changes the signature when a value's punctuation changes", () => {
    // item_name=Tea
    expect(buildSignature({ item_name: "Tea" })).toBe(
      "24013f0457dc0166c48aec9cc17f4855",
    );
    expect(buildSignature({ item_name: "Tea" })).not.toBe(
      buildSignature({ item_name: "Tea & Toast" }),
    );
  });

  it("uses uppercase hex escapes", () => {
    // a=%2F  (PHP urlencode). A lowercase-hex encoder would hash "a=%2f"
    // instead, which is f5bc... vs 956e...: a different signature, a rejected
    // payment, and no clue why.
    expect(buildSignature({ a: "/" })).toBe(
      "f5bcfaedbabe67387f18fa49cc47da4f",
    );
    expect(buildSignature({ a: "/" })).not.toBe(
      "956ed62de05f718ecf954ccf7e31c30e",
    );
  });

  it("signs in field order, not alphabetical order", () => {
    // PayFast signs the payment form in form order. If this ever passes, the
    // implementation has started sorting and every live payment will bounce.
    const inFormOrder = { merchant_id: "1", amount: "899.00" };
    const alphabetical = { amount: "899.00", merchant_id: "1" };
    expect(buildSignature(inFormOrder)).not.toBe(buildSignature(alphabetical));
  });

  it("omits empty-value fields from the base string", () => {
    // "name_last=" must never appear: the field is dropped, not signed blank.
    expect(buildSignature({ a: "1", b: "", c: "2" })).toBe(
      buildSignature({ a: "1", c: "2" }),
    );
    expect(buildSignature({ a: "1", b: "   ", c: "2" })).toBe(
      buildSignature({ a: "1", c: "2" }),
    );
  });

  it("trims surrounding whitespace before signing", () => {
    expect(buildSignature({ name_first: "  Thandi  " })).toBe(
      buildSignature({ name_first: "Thandi" }),
    );
  });
});

describe("buildPaymentFields", () => {
  it("emits the fields in PayFast's documented form order", () => {
    const fields = buildPaymentFields(ORDER, CONFIG);
    expect(Object.keys(fields)).toEqual([
      "merchant_id",
      "merchant_key",
      "return_url",
      "cancel_url",
      "notify_url",
      "name_first",
      "name_last",
      "email_address",
      "m_payment_id",
      "amount",
      "item_name",
      "signature",
    ]);
  });

  it("carries the order across in PayFast's shapes", () => {
    const fields = buildPaymentFields(ORDER, CONFIG);
    expect(fields.m_payment_id).toBe(ORDER.orderId);
    expect(fields.amount).toBe("899.00");
    expect(fields.item_name).toBe(ITEM_NAME);
    expect(fields.email_address).toBe("thandi@example.co.za");
    expect(fields.name_first).toBe("Thandi");
  });

  it("builds the callback URLs off the site URL", () => {
    const fields = buildPaymentFields(ORDER, CONFIG);
    // The return URL carries the order's signed token, so PayFast hands the
    // customer back to their own order rather than to a page that has to ask
    // who they are. It is a status page, not a receipt: see order/[token].
    expect(fields.return_url).toBe(
      `https://kindredcreature.co.za/order/${RETURN_TOKEN}`,
    );
    expect(fields.cancel_url).toBe(
      "https://kindredcreature.co.za/checkout/cancelled",
    );
    expect(fields.notify_url).toBe(
      "https://kindredcreature.co.za/api/payfast/notify",
    );
  });

  it("puts the welcome token on the return_url and NOWHERE else", () => {
    // The D3 security matrix: the one-time login rides the URL PayFast only
    // sends a buyer to after payment. cancel_url must never carry it (backing
    // out proves nothing about owning the email) and no other field may leak it.
    const welcome = "d2VsY29tZS10b2tlbg";
    const fields = buildPaymentFields(
      { ...ORDER, welcomeToken: welcome },
      CONFIG,
    );

    expect(fields.return_url).toBe(
      `https://kindredcreature.co.za/order/${RETURN_TOKEN}?welcome=${welcome}`,
    );
    expect(fields.cancel_url).toBe(
      "https://kindredcreature.co.za/checkout/cancelled",
    );
    for (const [key, value] of Object.entries(fields)) {
      if (key === "return_url") continue;
      expect(value).not.toContain(welcome);
    }
    // And the signature covers the URL it rides on.
    expect(verifyItnSignature(fields)).toBe(true);
  });

  it("leaves the return_url bare when no welcome token is given", () => {
    const fields = buildPaymentFields(ORDER, CONFIG);
    expect(fields.return_url).not.toContain("welcome");
  });

  it("signs a different amount differently", () => {
    const a = buildPaymentFields(ORDER, CONFIG);
    const b = buildPaymentFields({ ...ORDER, totalZar: 1 }, CONFIG);
    expect(a.signature).not.toBe(b.signature);
  });

  it("produces a payload that verifies against itself", () => {
    const withPass = { ...CONFIG, passphrase: PASSPHRASE };
    const fields = buildPaymentFields(ORDER, withPass);
    expect(verifyItnSignature(fields, PASSPHRASE)).toBe(true);
  });
});

describe("verifyItnSignature", () => {
  /** An ITN as PayFast posts it: our fields plus the gateway's own. */
  function itn(overrides: Record<string, string> = {}) {
    const posted: Record<string, string> = {
      m_payment_id: ORDER.orderId,
      pf_payment_id: "1089250",
      payment_status: "COMPLETE",
      item_name: ITEM_NAME,
      amount_gross: "899.00",
      amount_fee: "-20.68",
      amount_net: "878.32",
      merchant_id: CONFIG.merchantId,
      ...overrides,
    };
    return { ...posted, signature: buildSignature(posted, PASSPHRASE) };
  }

  it("accepts a correctly signed payload", () => {
    expect(verifyItnSignature(itn(), PASSPHRASE)).toBe(true);
  });

  it("accepts a correctly signed payload with no passphrase", () => {
    const posted = { m_payment_id: ORDER.orderId, amount_gross: "899.00" };
    const signed = { ...posted, signature: buildSignature(posted) };
    expect(verifyItnSignature(signed)).toBe(true);
  });

  it("rejects a tampered amount", () => {
    // The attack this exists to stop: pay R 1, claim R 899 was received.
    const tampered = { ...itn(), amount_gross: "1.00" };
    expect(verifyItnSignature(tampered, PASSPHRASE)).toBe(false);
  });

  it("rejects a tampered payment status", () => {
    const tampered = { ...itn({ payment_status: "FAILED" }) };
    tampered.payment_status = "COMPLETE";
    expect(verifyItnSignature(tampered, PASSPHRASE)).toBe(false);
  });

  it("rejects a payload signed with the wrong passphrase", () => {
    expect(verifyItnSignature(itn(), "not-the-passphrase")).toBe(false);
  });

  it("rejects a payload signed without the passphrase we hold", () => {
    expect(verifyItnSignature(itn(), undefined)).toBe(false);
  });

  it("rejects a payload with no signature at all", () => {
    const unsigned = withoutSignature(itn());
    expect(verifyItnSignature(unsigned, PASSPHRASE)).toBe(false);
    expect(verifyItnSignature({ ...unsigned, signature: "" }, PASSPHRASE)).toBe(
      false,
    );
  });

  it("rejects a signature of the wrong length without throwing", () => {
    // timingSafeEqual throws on length mismatch, so this must be caught earlier.
    expect(() =>
      verifyItnSignature({ ...itn(), signature: "abc" }, PASSPHRASE),
    ).not.toThrow();
    expect(verifyItnSignature({ ...itn(), signature: "abc" }, PASSPHRASE)).toBe(
      false,
    );
  });

  it("accepts an uppercase signature", () => {
    const signed = itn();
    expect(
      verifyItnSignature(
        { ...signed, signature: signed.signature.toUpperCase() },
        PASSPHRASE,
      ),
    ).toBe(true);
  });

  it("depends on the order fields were received in", () => {
    // PayFast signs the posted order, so a reordered payload is a different
    // payload. This pins that the helper is not quietly sorting.
    const posted = { b: "2", a: "1" };
    const signed = { ...posted, signature: buildSignature(posted) };
    expect(verifyItnSignature(signed)).toBe(true);
    expect(verifyItnSignature({ a: "1", b: "2", signature: signed.signature })).toBe(
      false,
    );
  });
});

describe("environment switches", () => {
  // The env is process-wide within a file, so every test here gets the same
  // clean slate back regardless of how it ends.
  const env = { ...process.env };

  beforeEach(() => {
    delete process.env.MOCK_SERVICES;
    delete process.env.PAYFAST_SANDBOX;
    delete process.env.PAYFAST_MERCHANT_ID;
    delete process.env.PAYFAST_MERCHANT_KEY;
    delete process.env.PAYFAST_PASSPHRASE;
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it("picks the sandbox host when PAYFAST_SANDBOX is true", () => {
    process.env.PAYFAST_SANDBOX = "true";
    expect(payfastProcessUrl()).toBe(
      "https://sandbox.payfast.co.za/eng/process",
    );
  });

  it("picks the live host otherwise", () => {
    expect(payfastProcessUrl()).toBe("https://www.payfast.co.za/eng/process");
    process.env.PAYFAST_SANDBOX = "false";
    expect(payfastProcessUrl()).toBe("https://www.payfast.co.za/eng/process");
  });

  it("mocks when MOCK_SERVICES is on, even with credentials present", () => {
    process.env.MOCK_SERVICES = "true";
    process.env.PAYFAST_MERCHANT_ID = "10000100";
    process.env.PAYFAST_MERCHANT_KEY = "46f0cd694581a";
    expect(usingMockPayfast()).toBe(true);
  });

  it("mocks when credentials are absent", () => {
    expect(usingMockPayfast()).toBe(true);
  });

  it("mocks when only half the credentials are present", () => {
    process.env.PAYFAST_MERCHANT_ID = "10000100";
    expect(usingMockPayfast()).toBe(true);
  });

  it("goes live when credentials are present and mocking is off", () => {
    process.env.PAYFAST_MERCHANT_ID = "10000100";
    process.env.PAYFAST_MERCHANT_KEY = "46f0cd694581a";
    expect(usingMockPayfast()).toBe(false);
  });
});

describe("redactFields", () => {
  it("hides the merchant key and leaves the rest alone", () => {
    const fields = buildPaymentFields(ORDER, CONFIG);
    const safe = redactFields(fields);
    expect(safe.merchant_key).toBe("(hidden)");
    expect(safe.merchant_key).not.toContain("46f0cd694581a");
    expect(safe.amount).toBe("899.00");
    expect(safe.m_payment_id).toBe(ORDER.orderId);
    // The original is untouched: this returns a copy.
    expect(fields.merchant_key).toBe("46f0cd694581a");
  });

  it("never lets a merchant key through under any casing of the payload", () => {
    const safe = redactFields(buildPaymentFields(ORDER, CONFIG));
    expect(JSON.stringify(safe)).not.toContain("46f0cd694581a");
  });
});
