# Monday: get the database, admin and uploads working

Follow this top to bottom. Roughly 30 minutes. Nothing here requires writing code.

---

## The one thing to understand first

The app decides whether to use your real database with this rule:

```
Use real Postgres ONLY IF   NODE_ENV is production
                     AND    DATABASE_URL is set
                     AND    MOCK_SERVICES is NOT "true"
```

**`MOCK_SERVICES=true` turns the real database off**, even when `DATABASE_URL` is set
perfectly. It falls back to a temporary local database that Vercel wipes constantly, which
is why uploads disappear and admin login does not stick.

`LAUNCH_FREE_FIXED.md` in this folder tells you to set `MOCK_SERVICES=true` and calls it
required. **That is wrong. Ignore that file.** You do not need the flag at all: each
service already falls back to its own mock when its own key is missing.

---

## Step 1 · Create the database

1. Go to **vercel.com** and open your Kindred Creatures project
2. **Storage** tab → **Create Database** → **Postgres**
3. Name it `kindred-creatures`, pick the region closest to South Africa, **Create**
4. Connect it to the project when prompted

Vercel adds several variables automatically (`POSTGRES_URL`, `POSTGRES_PRISMA_URL` and
others). **The code does not read any of those.** It reads `DATABASE_URL` only.

5. Still in Storage, open the database, find **`.env.local`** or **Connection string**, and
   copy the value of `POSTGRES_URL`. It starts `postgres://`.

You will paste it as `DATABASE_URL` in Step 3.

---

## Step 2 · Create your admin password hash

On your own Mac, open Terminal and run:

```bash
cd ~/Desktop/Kindred\ Creatures
node scripts/hash-admin-password.ts
```

It asks `Admin password:` and waits. Type a password and press Enter.

- **Minimum 12 characters.** Shorter is rejected.
- The typing is invisible. That is normal, keep going.
- Note: the old guide said you can pass the password as an argument, or that the default
  is `admin`. Neither is true. It only prompts.

It prints a long line starting `ADMIN_PASSWORD_HASH=`. Copy everything after the `=`.

**Remember the password you typed.** The hash cannot be reversed. If you lose the
password, you generate a new hash and start again.

---

## Step 3 · Set the environment variables

Vercel → your project → **Settings** → **Environment Variables**.

Add each of these to **Production** (and Preview, so test deploys work too):

| Name | Value |
|---|---|
| `DATABASE_URL` | the `postgres://...` string from Step 1 |
| `ADMIN_EMAIL` | `lightening.sebastian@gmail.com` |
| `ADMIN_PASSWORD_HASH` | the hash from Step 2, pasted verbatim |
| `ORDER_TOKEN_SECRET` | `8c65841b1e68f1b9dba48381583a952bb9e15d7a02154318d1e0d0d0a60af24c` |
| `ASSET_TOKEN_SECRET` | `3cbf9952fdbfbe14446f7dbc4a6af5463cc0ab2e0602dbbbf1fd47cae67673c0` |
| `SESSION_SECRET` | `86f4554f1d335ef4346dbc622fc6ccd8276a06327cace63671ad722c1ae2a401` |
| `PAYFAST_SANDBOX` | `true` |
| `NEXT_PUBLIC_SITE_URL` | your live Vercel URL, no trailing slash |

The three secrets above were randomly generated for this project. They are fine to use.
They are not passwords and nobody needs to memorise them.

### Delete this one

| Name | Action |
|---|---|
| `MOCK_SERVICES` | **DELETE IT.** Not "false". Remove the variable entirely. |

### Do not set

`NODE_ENV` · Vercel sets it to `production` on its own. Setting it manually can break the
build.

### Paste discipline

No quotes. No trailing spaces. The password hash uses `:` separators specifically so it
survives being pasted raw into a box like this. Paste it exactly as printed.

---

## Step 4 · Add image storage

Uploaded photos need somewhere permanent to live. Without this they write to Vercel's
temporary disk and vanish.

1. Vercel → **Storage** → **Create Database** → **Blob**
2. Name it, create it, connect it to the project
3. Vercel adds `BLOB_READ_WRITE_TOKEN` automatically. Confirm it appears in Environment
   Variables. If it does not, copy it from the Blob store page and add it by hand.

---

## Step 5 · Redeploy

Environment changes do **not** apply to the running site. You must redeploy.

**Deployments** → newest one → the **···** menu → **Redeploy**. Wait about two minutes.

---

## Step 6 · Test, in this order

Stop at the first failure and tell me what you saw.

1. **Site loads.** Open your Vercel URL. Home page renders.
2. **Admin login.** Go to `/admin`. Enter your email and the password from Step 2.
   You should reach the dashboard, empty of orders.
3. **Admin session sticks.** Refresh the page. Still logged in.
   *If this fails, the database is still not connected.* It is the sharpest test there is:
   sessions survive a refresh only when Postgres is genuinely live.
4. **Upload.** Go to `/products/hoodie`, choose a colour and size, upload any photo.
   You should see your own photo come back as a preview.
5. **Portrait step.** Pick a style. You get a placeholder image, not a real portrait.
   **This is correct** while there is no OpenAI key. It proves the pipeline runs.
6. **Cart and checkout.** Add to cart, go to checkout, fill the form. You reach the
   PayFast sandbox. Do not complete a payment yet.
7. **Order appears.** Back in `/admin`, confirm the order exists.

---

## If something fails

**"Too many attempts"** · Five wrong passwords locks you out for 15 minutes. Wait it out.

**Admin login fails immediately** · Both `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` must be
present. With either missing the dashboard is sealed by design and no password can work.

**Logged out on refresh** · `DATABASE_URL` is wrong, or `MOCK_SERVICES` is still set.
Check that you deleted the variable rather than setting it to `false`, and that you
redeployed afterwards.

**Upload fails** · Usually `BLOB_READ_WRITE_TOKEN` missing, or the database is not
connected. Work through Step 6 in order; test 3 tells you which.

**Reading the logs** · Deployments → click the deployment → **Runtime Logs**. Copy the red
lines and send them to me. I do not need the whole log, just the error.

---

## What this does NOT do

Deliberately out of scope today. Each is a separate job.

- Real portraits · needs `OPENAI_API_KEY`, and `MOCK_SERVICES` must stay unset
- Real emails · needs `RESEND_API_KEY` and a verified sending domain
- Real payments · needs live PayFast credentials. Sandbox only for now
- Analytics · needs `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Do it once the above works
