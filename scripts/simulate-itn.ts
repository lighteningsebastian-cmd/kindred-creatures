/**
 * Posts a correctly signed ITN at a locally running shop, so the payment path
 * can be exercised end to end without PayFast having to exist.
 *
 * USAGE
 *
 *   node --env-file=.env.local scripts/simulate-itn.ts <orderId> <amountZar> [options]
 *
 * Node 24 runs this file directly (it strips the types); there is no build step
 * and no extra dependency. Drop --env-file if your variables are already
 * exported.
 *
 *   node --env-file=.env.local scripts/simulate-itn.ts 3f7c...a91 998
 *
 * Options:
 *   --status <s>    payment_status to send. Default COMPLETE. Try FAILED.
 *   --pf-id <id>    pf_payment_id. Defaults to a fresh one each run, so re-running
 *                   with the SAME id is how you test the idempotent replay.
 *   --url <origin>  Where the shop is. Default http://localhost:3000.
 *
 * WHAT THE SHOP NEEDS FOR THIS TO WORK (.env.local):
 *
 *   MOCK_SERVICES=true      The webhook posts every real ITN back to PayFast to
 *                           confirm they sent it, and PayFast has never heard of
 *                           this one. MOCK_SERVICES skips that check, and only
 *                           does so outside production. Without it: 400.
 *   PAYFAST_MERCHANT_ID=10000100
 *                           The webhook checks the notification names our shop.
 *                           A shop with no merchant id rejects every ITN, so
 *                           this must be set on BOTH sides and must match.
 *   PAYFAST_PASSPHRASE=...  Optional, but if the shop has one, so must this, or
 *                           the signature will not verify.
 *
 * THINGS WORTH TRYING
 *
 *   Same --pf-id twice           second one changes nothing (200, one event row)
 *   An amountZar that is not the order total   flags the order, never pays it
 *   --status FAILED              order stays pending
 *   Edit a byte of the signature by hand       400, order untouched
 */

import { buildSignature, toAmountString } from "../src/lib/payfast.ts";
import { signOrderToken } from "../src/lib/order-token.ts";

type Options = {
  orderId: string;
  amountZar: number;
  status: string;
  pfPaymentId: string;
  origin: string;
};

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  console.error("  Usage: node --env-file=.env.local scripts/simulate-itn.ts");
  console.error("         <orderId> <amountZar> [--status COMPLETE]");
  console.error("         [--pf-id 1234567] [--url http://localhost:3000]\n");
  process.exit(1);
}

function parseArgs(argv: string[]): Options {
  const positional: string[] = [];
  const flags = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith("--")) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        fail(`${arg} needs a value.`);
      }
      flags.set(arg.slice(2), value);
      index += 1;
    } else {
      positional.push(arg);
    }
  }

  const [orderId, amount] = positional;
  if (!orderId) fail("Which order? Pass the orderId the checkout gave you.");
  if (!amount) fail("How much, in whole rands? Pass the order total.");

  const amountZar = Number(amount);
  if (!Number.isFinite(amountZar)) fail(`"${amount}" is not an amount.`);

  return {
    orderId,
    amountZar,
    status: flags.get("status") ?? "COMPLETE",
    // Unique per run unless pinned, because the shop treats a repeated
    // pf_payment_id as a retry of a notification it has already handled.
    pfPaymentId: flags.get("pf-id") ?? String(Date.now()),
    origin: (flags.get("url") ?? "http://localhost:3000").replace(/\/+$/, ""),
  };
}

/**
 * An ITN as PayFast sends one. The key order matters twice over: it is the
 * order the signature is built in (see buildSignature) and the order the fields
 * go on the wire in, and the webhook rebuilds the base string from what it
 * receives. Shuffle these and the signature will not verify, which is correct
 * of it but confusing of us.
 */
function itnFields(
  options: Options,
  merchantId: string,
  passphrase?: string,
): Record<string, string> {
  const gross = toAmountString(options.amountZar);

  const fields: Record<string, string> = {
    m_payment_id: options.orderId,
    pf_payment_id: options.pfPaymentId,
    payment_status: options.status,
    item_name: "Kindred Creatures order",
    amount_gross: gross,
    amount_fee: "-22.94",
    amount_net: toAmountString(options.amountZar - 22.94),
    name_first: "Thandi",
    name_last: "Mokoena",
    email_address: "thandi@example.co.za",
    merchant_id: merchantId,
  };

  // keepEmpty, because this script is pretending to be PayFast and PayFast
  // signs its empty fields as key=. Sign them the outbound way and this
  // simulator would be testing the webhook against a payload the real gateway
  // never sends, which is worse than not testing it.
  return {
    ...fields,
    signature: buildSignature(fields, passphrase, { keepEmpty: true }),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const merchantId = process.env.PAYFAST_MERCHANT_ID?.trim();
  if (!merchantId) {
    fail(
      "PAYFAST_MERCHANT_ID is not set. The webhook rejects every ITN without " +
        "one, so set it in .env.local (10000100 is PayFast's sandbox id) and " +
        "pass --env-file=.env.local.",
    );
  }

  const passphrase = process.env.PAYFAST_PASSPHRASE?.trim() || undefined;
  const fields = itnFields(options, merchantId, passphrase);
  const body = new URLSearchParams(fields).toString();
  const target = `${options.origin}/api/payfast/notify`;

  console.log(`\n  POST ${target}`);
  console.log(`  order        ${options.orderId}`);
  console.log(`  amount_gross ${fields.amount_gross}`);
  console.log(`  status       ${options.status}`);
  console.log(`  pf_payment_id ${options.pfPaymentId}`);

  let response: Response;
  try {
    response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (error) {
    fail(
      `Could not reach ${target}. Is the shop running? ` +
        `(${error instanceof Error ? error.message : String(error)})`,
    );
  }

  const answer = (await response.text()).trim();
  console.log(`\n  ${response.status} ${answer}`);

  if (response.status === 200) {
    console.log("\n  The shop accepted the notification. What it made of it is");
    console.log("  in the orders row and in webhook_events.raw: a 200 means");
    console.log("  \"recorded\", not \"paid\". Check the order page:\n");
    console.log(`  ${options.origin}/order/${signOrderToken(options.orderId)}\n`);
  } else {
    console.log("\n  Rejected, and deliberately without saying why. The likely");
    console.log("  causes are a passphrase or merchant id that does not match");
    console.log("  the shop's, or MOCK_SERVICES not being on so the webhook");
    console.log("  tried to confirm this with the real PayFast.\n");
  }
}

await main();
