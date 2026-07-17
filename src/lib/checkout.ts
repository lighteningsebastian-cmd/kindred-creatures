/**
 * Checkout rules shared by the form and the /api/checkout route, so the inline
 * errors someone sees while typing are the same rules the server enforces. This
 * module is deliberately free of database, React and store imports: it is pure,
 * and both a client island and a route handler can pull it in.
 */

/** Quantities live in 1..10. The cart clamps to these; checkout re-checks them. */
export const MIN_QTY = 1;
export const MAX_QTY = 10;

// PLACEHOLDER: flat national shipping rate, in whole rands. Standing in until
// the Cape Town print partner confirms courier costing (and until the "free
// over R750" promise in the utility bar is priced). Single source of truth:
// the server reads this at checkout, the summary renders it, nothing else
// hardcodes 99.
export const SHIPPING_FLAT_ZAR = 99;

/** The nine South African provinces, in the order the select offers them. */
export const SA_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
] as const;

export type SaProvince = (typeof SA_PROVINCES)[number];

export function isSaProvince(value: unknown): value is SaProvince {
  return (
    typeof value === "string" &&
    (SA_PROVINCES as readonly string[]).includes(value)
  );
}

/** Where an order is going, plus how to reach the person expecting it. */
export interface CustomerDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  suburb: string;
  city: string;
  province: SaProvince;
  postalCode: string;
}

/** Every field the form collects; addressLine2 is the only optional one. */
export type CustomerField = keyof CustomerDetails;

export const CUSTOMER_FIELDS: CustomerField[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "addressLine1",
  "addressLine2",
  "suburb",
  "city",
  "province",
  "postalCode",
];

export type CustomerErrors = Partial<Record<CustomerField, string>>;

const MAX_FIELD_LENGTH = 120;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Deliberately loose: the job is to catch typos and obvious rubbish, not to
// adjudicate RFC 5322. Anything that gets past this is proven by the order
// confirmation actually arriving.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Four digits, which is every South African postal code. */
const POSTAL_CODE_PATTERN = /^\d{4}$/;

/**
 * Plausible SA phone number: 9 to 15 digits once punctuation is stripped, which
 * accepts "082 123 4567", "+27 82 123 4567" and "(021) 555-0100" while turning
 * away someone who typed their name in the box.
 */
function isPlausiblePhone(value: string): boolean {
  const digits = value.replace(/[\s()\-.+]/g, "");
  return /^\d{9,15}$/.test(digits);
}

/**
 * Validates the shipping details. Returns the trimmed, typed details when every
 * field passes, or a per-field map of human errors when they do not. The
 * messages are written to be shown to a customer as-is.
 */
export function validateCustomerDetails(
  input: Partial<Record<CustomerField, unknown>>,
): { ok: true; value: CustomerDetails } | { ok: false; errors: CustomerErrors } {
  const firstName = text(input.firstName);
  const lastName = text(input.lastName);
  const email = text(input.email);
  const phone = text(input.phone);
  const addressLine1 = text(input.addressLine1);
  const addressLine2 = text(input.addressLine2);
  const suburb = text(input.suburb);
  const city = text(input.city);
  const province = text(input.province);
  const postalCode = text(input.postalCode);

  const errors: CustomerErrors = {};

  if (!firstName) errors.firstName = "Please tell us your first name.";
  if (!lastName) errors.lastName = "Please tell us your last name.";

  if (!email) {
    errors.email = "We need an email address to send your order updates to.";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "That email address does not look right. Please check it.";
  }

  if (!phone) {
    errors.phone = "The courier needs a number to call on delivery day.";
  } else if (!isPlausiblePhone(phone)) {
    errors.phone = "That phone number does not look right. Please check it.";
  }

  if (!addressLine1) errors.addressLine1 = "Please give us a street address.";
  if (!suburb) errors.suburb = "Please give us a suburb.";
  if (!city) errors.city = "Please give us a city or town.";

  if (!province) {
    errors.province = "Please choose your province.";
  } else if (!isSaProvince(province)) {
    errors.province = "Please choose one of the nine provinces.";
  }

  if (!postalCode) {
    errors.postalCode = "Please give us a postal code.";
  } else if (!POSTAL_CODE_PATTERN.test(postalCode)) {
    errors.postalCode = "A South African postal code is four digits.";
  }

  for (const field of CUSTOMER_FIELDS) {
    const value = text(input[field]);
    if (!errors[field] && value.length > MAX_FIELD_LENGTH) {
      errors[field] = `Please keep this under ${MAX_FIELD_LENGTH} characters.`;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      firstName,
      lastName,
      email,
      phone,
      addressLine1,
      addressLine2,
      suburb,
      city,
      province: province as SaProvince,
      postalCode,
    },
  };
}

/** Whole-rand quantity check, matching the cart's own 1..10 clamp. */
export function isValidQty(qty: unknown): qty is number {
  return (
    typeof qty === "number" &&
    Number.isInteger(qty) &&
    qty >= MIN_QTY &&
    qty <= MAX_QTY
  );
}

/** Order maths in one place: shipping is flat, so the total is the sum. */
export function orderTotals(subtotalZar: number): {
  subtotalZar: number;
  shippingZar: number;
  totalZar: number;
} {
  const shippingZar = SHIPPING_FLAT_ZAR;
  return { subtotalZar, shippingZar, totalZar: subtotalZar + shippingZar };
}
