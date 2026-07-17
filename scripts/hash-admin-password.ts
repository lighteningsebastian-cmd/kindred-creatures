/**
 * Generates the ADMIN_PASSWORD_HASH value for .env.local.
 *
 * USAGE
 *
 *   node scripts/hash-admin-password.ts
 *
 * Node 24 runs this file directly (it strips the types); there is no build step
 * and no extra dependency. It prompts for the password on stdin rather than
 * taking it as an argument, because an argument ends up in your shell history
 * and in the process list of every other user on the machine.
 *
 * Paste the printed line into .env.local. The hash carries its own salt and cost
 * parameters, so it is the whole of what needs storing: there is no second
 * secret to keep alongside it, and the admin session key is derived from it (see
 * src/lib/admin/session.ts), which means changing the password also signs out
 * every live session.
 *
 * The hash is not a password. It cannot be replayed at the login form and it is
 * not worth hiding from yourself. It IS worth keeping out of the repository:
 * .env.local is gitignored, and it should stay that way.
 *
 * PASTE IT VERBATIM, in .env.local and in your host's environment variable box
 * alike: no quotes, no escaping, no trailing spaces. The hash is colon-separated
 * rather than the conventional `$`-separated precisely so that it can be pasted
 * as-is into both. See SEPARATOR in src/lib/admin/password.ts for what a `$`
 * costs here.
 */

import { createInterface } from "node:readline/promises";
import { hashPassword } from "../src/lib/admin/password.ts";

/** Long enough that scrypt is doing the work and not the only thing doing it. */
const MIN_LENGTH = 12;

async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const password = await rl.question("Admin password: ");

    if (password.length < MIN_LENGTH) {
      console.error(
        `\nThat is ${password.length} characters. Use at least ${MIN_LENGTH}: this one password is the whole of the admin's security.`,
      );
      process.exitCode = 1;
      return;
    }

    const hash = await hashPassword(password);

    console.log("\nAdd this to .env.local (and set ADMIN_EMAIL beside it):\n");
    console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
  } finally {
    rl.close();
  }
}

await main();
