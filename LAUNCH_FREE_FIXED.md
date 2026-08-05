# Launch Free - Fixed (With All Required Environment Variables)

The previous launch guide was **incomplete**. You're missing critical environment variables. Here's what's actually needed:

---

## The Problem

❌ Admin login requires **both** `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH`  
❌ Upload doesn't work because `DATABASE_URL` is missing  
❌ Everything else fails because the database isn't connected  

---

## Step 1: Set Up Database (Pick One)

### **Option A: Vercel Postgres (EASIEST)**

1. Go to **vercel.com** → Your project
2. Go to **Storage** tab
3. Click **"Create Database"** → **"Postgres"**
4. Name it: `kindred-creatures`
5. Click **"Create"**
6. Vercel auto-adds `POSTGRES_PRISMA_URL` to env vars

✅ **Done** — the connection string is automatically added.

### **Option B: Railway.app (Also Good)**

1. Go to railway.app
2. Create new project → PostgreSQL
3. Copy the connection string
4. In Vercel, add env var: `DATABASE_URL=postgresql://...`

---

## Step 2: Generate Admin Password Hash

Run this command on your computer:

```bash
cd /Users/sebastianlightening/Desktop/Kindred\ Creatures
node scripts/hash-admin-password.ts
```

This outputs something like:
```
$2a$10$abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yz
```

**Copy this entire string** — you'll need it in the next step.

---

## Step 3: Set Environment Variables in Vercel

Go to **Vercel dashboard** → Your project → **Settings** → **Environment Variables**

Add **ALL of these** (don't skip any):

```
DATABASE_URL                     [from Step 1 above, or your Railway URL]
MOCK_SERVICES                    true
NODE_ENV                         production

ADMIN_EMAIL                      [paste your email: lightening.sebastian@gmail.com]
ADMIN_PASSWORD_HASH              [paste the hash from Step 2]

PAYFAST_SANDBOX                  true
PAYFAST_MERCHANT_ID              0
PAYFAST_MERCHANT_KEY             test
PAYFAST_PASSPHRASE               test

ORDER_TOKEN_SECRET               your-secret-string-here-make-it-random
ASSET_TOKEN_SECRET               another-random-secret-string

RESEND_API_KEY                   [optional: leave blank for now]
OPENAI_API_KEY                   [optional: leave blank for now]
BLOB_READ_WRITE_TOKEN            [optional: Vercel fills this automatically]
```

**Critical ones (don't leave blank):**
- `DATABASE_URL` ← REQUIRED
- `ADMIN_EMAIL` ← REQUIRED (your email)
- `ADMIN_PASSWORD_HASH` ← REQUIRED (the hash from Step 2)
- `MOCK_SERVICES=true` ← REQUIRED

---

## Step 4: Redeploy

1. In Vercel, go to **Deployments**
2. Find the most recent deployment
3. Click the **three dots** → **Redeploy**
4. Wait 2 minutes for it to finish

---

## Step 5: Test Everything

### Test Upload:
1. Go to `https://your-app.vercel.app/products/hoodie`
2. Click "Upload the photo that captures them best"
3. Upload any image
4. Should show a preview of your uploaded image

### Test Style Selection:
1. After upload, click one of the 3 styles
2. Should generate a preview (will be a mock image in `MOCK_SERVICES=true` mode)

### Test Admin:
1. Go to `/admin`
2. Email: `lightening.sebastian@gmail.com`
3. Password: **the password you used when generating the hash**
   - If you ran the script without custom password, default is: `admin`
4. Should log you in

---

## If You Get "Too many attempts" Error

You tried to log in with wrong password 5+ times.

**Wait 15 minutes**, then try again with the correct password.

---

## What If You Don't Have the Password Hash?

Run the script again to generate a new one:

```bash
cd /Users/sebastianlightening/Desktop/Kindred\ Creatures
node scripts/hash-admin-password.ts
```

If you want a custom password instead of "admin":

```bash
node scripts/hash-admin-password.ts your-password-here
```

Then use that hash in Vercel.

---

## Complete Env Vars Checklist

```
✅ DATABASE_URL — Required, from Vercel Postgres or Railway
✅ ADMIN_EMAIL — Required, your email
✅ ADMIN_PASSWORD_HASH — Required, generated from script
✅ MOCK_SERVICES=true — Required
✅ NODE_ENV=production — Required
✅ PAYFAST_SANDBOX=true — Optional but recommended
✅ ORDER_TOKEN_SECRET — Optional but good to set
✅ ASSET_TOKEN_SECRET — Optional but good to set
```

---

## Testing Checklist (After Redeploy)

- ☐ Photo upload works (shows preview of your uploaded image)
- ☐ Style selection works (generates placeholder preview)
- ☐ Regenerate works (3 tries per photo)
- ☐ Admin login works (email + password)
- ☐ Admin dashboard loads (shows orders)
- ☐ Checkout form shows (when you add to cart)

---

## If Upload Still Doesn't Work

**Check these:**

1. Is `DATABASE_URL` actually set in Vercel?
   - Go to Settings → Environment Variables
   - Verify it's there
   - If not, Vercel Postgres might not have created it

2. Did you redeploy after setting env vars?
   - Environment changes require a redeploy
   - Click Deployments → Redeploy on latest

3. Check the Vercel build logs:
   - Go to Deployments → Most recent
   - Click the deployment to see logs
   - Look for error messages

---

## Quick Command Reference

**Generate password hash (default password = "admin"):**
```bash
cd /Users/sebastianlightening/Desktop/Kindred\ Creatures
node scripts/hash-admin-password.ts
```

**Generate hash with custom password:**
```bash
node scripts/hash-admin-password.ts my-secure-password
```

---

## Summary: What You Did Wrong

1. ❌ Didn't set `DATABASE_URL` — upload needs the database
2. ❌ Didn't set `ADMIN_EMAIL` — admin login needs both email AND password
3. ❌ Didn't generate `ADMIN_PASSWORD_HASH` — need a proper hashed password
4. ❌ Set `MOCK_SERVICES=true` but didn't set the other required vars

**Now you know.** Go set all the env vars in Vercel, redeploy, and test again.
