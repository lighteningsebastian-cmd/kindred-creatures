# Launch for Free (Right Now, for Testing)

You can launch this app **completely free** today with zero API costs. You'll use mock data for testing, then add real payments/images later.

---

## What's Free Right Now

✅ **GitHub** — Free unlimited public repos  
✅ **Vercel** — Free tier (covers your traffic)  
✅ **Database** — Free options (Railway, Render, or local)  
✅ **Email** — Resend free tier (100 emails/day)  
✅ **Image generation** — Mock images (no OpenAI cost)  
✅ **Payments** — Disabled (skip PayFast for now)  

**Total cost: $0**

---

## Quick Start: 30-Minute Launch

### Step 1: Push code to GitHub (5 min)

If your code isn't on GitHub yet:

```bash
cd /Users/sebastianlightening/Desktop/Kindred\ Creatures

# Initialize git if not already done
git init
git add .
git commit -m "Initial commit"

# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR-USERNAME/kindred-creatures.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Vercel (5 min)

1. Go to **vercel.com**
2. Sign up with GitHub (or log in)
3. Click **"Add New" → "Project"**
4. Select your `kindred-creatures` repo
5. Click **"Deploy"**
6. Wait ~2 minutes

**Your app is now live at:** `kindred-creatures.vercel.app`

### Step 3: Set Environment Variables (10 min)

Your app needs these for free testing:

1. In Vercel dashboard, go to **Settings → Environment Variables**
2. Add these variables:

```
# Database — use free tier
DATABASE_URL=postgresql://postgres:password@db.example.com/kindred

# Use mock image generation (no OpenAI cost)
MOCK_SERVICES=true

# Email — use Resend free tier (optional for testing)
RESEND_API_KEY=re_xxxx

# Storage — use local filesystem for now
# (No Vercel Blob needed, using dev mode)

# Admin password
ADMIN_PASSWORD_HASH=test

# Disable payments for now
PAYFAST_SANDBOX=true
PAYFAST_MERCHANT_ID=0
PAYFAST_MERCHANT_KEY=test
```

3. Click **"Save"** and wait for redeploy (~2 min)

### Step 4: Test Your App (10 min)

1. Visit **https://kindred-creatures.vercel.app**
2. Upload a pet photo
3. Try the 3 styles (uses mock AI, shows placeholder images)
4. Test checkout (shows PayFast form but doesn't charge)
5. Test admin dashboard at `/admin` (password: `test`)

---

## Free Database Options

You have three choices for a free database:

### **Option A: Railway.app** (EASIEST)
- ✅ Free tier = $5 credit/month (plenty for testing)
- ✅ PostgreSQL included
- ✅ Auto-backups
- Setup:
  1. Sign up at railway.app
  2. Create PostgreSQL database
  3. Copy connection string
  4. Paste into Vercel as `DATABASE_URL`

### **Option B: Render.com**
- ✅ Free tier PostgreSQL (with limits)
- ✅ Good for testing
- Setup: Similar to Railway

### **Option C: Vercel Postgres (Free Tier)**
- ✅ Vercel's own database service
- ✅ Includes free tier
- ✅ Easiest (one-click in Vercel)
- Setup:
  1. Go to Vercel dashboard
  2. Click **Storage → Create Database → Postgres**
  3. Connection string auto-added to env vars

**Recommendation:** Use **Vercel Postgres free tier** (simplest, one click).

---

## Image Generation: Two Options

### **Option A: Mock Images (FREE)** ← Recommended for testing
The app already has this built in. Set `MOCK_SERVICES=true` and:
- ✅ Photo upload works
- ✅ Style selection works
- ✅ Generates placeholder artwork (instant, free)
- ❌ Not photorealistic (that's okay for testing)

```bash
# In Vercel environment variables:
MOCK_SERVICES=true
```

### **Option B: Real OpenAI Images (costs money)**
Once you want real AI portraits:
1. Add `OPENAI_API_KEY` to Vercel env vars
2. Set `MOCK_SERVICES=false`
3. Budget ~$10/month for testing

---

## Payments: Disabled for Testing

The app already supports a "test mode" without PayFast:

```
# In Vercel environment variables:
PAYFAST_SANDBOX=true
PAYFAST_MERCHANT_ID=0
PAYFAST_MERCHANT_KEY=test
```

When someone tries to checkout:
- ✅ Checkout form appears
- ✅ Can enter test card details
- ✅ Shows "sandbox mode" notice
- ❌ No real transaction happens

This is perfect for testing the customer journey before real payments.

---

## The Absolute Minimum to Launch Free

```
Step 1: Push to GitHub
  git push origin main

Step 2: Deploy to Vercel
  - Connect repo
  - Click deploy

Step 3: Add ONE env var
  MOCK_SERVICES=true

Step 4: Add free database (optional, but recommended)
  - Vercel Postgres free tier, OR
  - Railway.app free tier

That's it. App is live.
```

**Total time: ~15 minutes**  
**Total cost: $0**

---

## Full Environment Variables for Free Launch

Copy this into Vercel Settings → Environment Variables:

```
# Database — choose one:
DATABASE_URL=postgresql://user:pass@your-db-host/kindred

# Mock services (no API costs)
MOCK_SERVICES=true
NODE_ENV=production

# Email (use Resend free tier — optional for testing)
RESEND_API_KEY=re_xxxxxxxxxxxx

# Payments disabled
PAYFAST_SANDBOX=true
PAYFAST_MERCHANT_ID=0
PAYFAST_MERCHANT_KEY=test
PAYFAST_PASSPHRASE=test

# Admin
ADMIN_PASSWORD_HASH=$2a$10$test

# Storage token (optional, uses local for now)
BLOB_READ_WRITE_TOKEN=vercel_blob_mock

# Secrets
ORDER_TOKEN_SECRET=random-string-here
ASSET_TOKEN_SECRET=random-string-here
```

---

## Testing Checklist (Free Launch)

- ☐ App is deployed at vercel.app URL
- ☐ Upload pet photo works
- ☐ Photo is stored (check in Vercel Blob or local storage)
- ☐ Style selection works (gets 3 choices)
- ☐ Mock image generation completes (instant)
- ☐ Preview shows (even if placeholder)
- ☐ Regenerate button works (can try 3 times)
- ☐ "Add to cart" button works
- ☐ Checkout page loads
- ☐ Admin dashboard loads at `/admin` with password `test`
- ☐ Emails work (check logs or Resend dashboard)

---

## Adding Real Payments Later

When you're ready to go live:

1. **Get PayFast merchant account** (apply at payfast.co.za)
2. **Once approved, update env vars:**
   ```
   PAYFAST_SANDBOX=false
   PAYFAST_MERCHANT_ID=your-id-here
   PAYFAST_MERCHANT_KEY=your-key-here
   PAYFAST_PASSPHRASE=your-passphrase
   ```
3. **Redeploy** (Vercel auto-redeploys when env vars change)

---

## Adding Real AI Images Later

When you want photorealistic portraits:

1. **Sign up at openai.com**
2. **Add payment method**
3. **Get API key**
4. **Update env vars:**
   ```
   OPENAI_API_KEY=sk-proj-xxxxx
   MOCK_SERVICES=false
   ```
5. **Redeploy**

Budget: ~$10–20/month for testing, scales with volume.

---

## Troubleshooting the Free Launch

### "DATABASE_URL is missing"
- You skipped adding the database
- Go to Vercel Settings → Storage → Create Postgres
- Copy connection string to env vars

### "App is blank / white screen"
- Check Vercel deployment logs (Deployments tab)
- Look for error messages
- Most common: missing `DATABASE_URL`

### "Upload doesn't work"
- Blob storage not configured
- Using local filesystem (`.data/uploads`)
- This is fine for testing, persists across redeployments

### "Emails aren't sending"
- Resend API key is wrong or expired
- Check Resend dashboard (resend.com)
- Emails go to spam if not verified domain
- For testing, just skip email or use console logging

### "Checkout shows 'Invalid merchant'"
- PayFast credentials are placeholders (this is expected)
- Change to real credentials when ready
- For now, checkout form just shows sandbox notice

---

## Next: From Testing to Live

Once you've tested everything and want to go live:

1. **Set up real database** (Vercel Postgres paid, or Railway)
2. **Add real OpenAI API key** (set `MOCK_SERVICES=false`)
3. **Get PayFast merchant account** (48-hour approval)
4. **Update all env vars** in Vercel
5. **Update Xneelo DNS** to point to Vercel
6. **You're live**

---

## Cost Progression

### **Now (Free Testing)**
```
Vercel:          $0 (free tier)
Database:        $0 (free tier)
Email:           $0 (Resend free: 100/day)
Images:          $0 (mock)
Payments:        $0 (disabled)
─────────────────────────────
Total:           $0
```

### **After Adding Real Images**
```
Vercel:          $0 (free tier)
Database:        $0 (free tier)
Email:           $0 (Resend free: 100/day)
Images:          $5–15/mo (OpenAI)
Payments:        $0 (still testing)
─────────────────────────────
Total:           $5–15/mo
```

### **Go Live**
```
Vercel:          $0–20/mo (paid tier for traffic)
Database:        $15/mo (Vercel Postgres hobby)
Email:           $20/mo (Resend paid)
Images:          $10/mo (OpenAI)
Payments:        2.5% + R1.50/txn (PayFast)
─────────────────────────────
Total:           $45–65/mo + % of sales
```

---

## The Absolute Fastest Path (15 Minutes)

**If you just want to see it live right now:**

```bash
# 1. Push to GitHub (2 min)
git add .
git commit -m "Ready to launch"
git push origin main

# 2. Deploy to Vercel (3 min)
# Go to vercel.com → Add project → Select repo → Deploy

# 3. Add env var (2 min)
# Vercel Settings → Environment Variables
# Add: MOCK_SERVICES=true

# 4. Wait for redeploy (2 min)
# Check Deployments tab

# 5. Visit your app (1 min)
# https://kindred-creatures.vercel.app
```

**15 minutes. $0. App is live for testing.**

---

## Ready to Launch?

1. **Tell me you have GitHub access** (or I can help push the code)
2. **Create Vercel account** (5 minutes, free)
3. **Deploy** (5 minutes)
4. **Add one env var** (2 minutes)
5. **Test** (5 minutes)

Want me to walk you through it step-by-step?
