# Deployment Guide: From WordPress to Next.js

This is completely different from WordPress. WordPress is hosted software (you upload files via FTP), but this is a **full-stack JavaScript app** that needs multiple services connected.

Think of it this way:
- **WordPress** = All-in-one box. You pay Bluehost, you get everything.
- **This app** = LEGO blocks. You connect pieces from different companies.

---

## The Big Picture: What You Need

```
Your App (Vercel)
    ↓
    ├─ Database (PostgreSQL)
    ├─ File Storage (Vercel Blob)
    ├─ Email (Resend)
    ├─ Image AI (OpenAI)
    └─ Payments (PayFast)
```

---

## Service-by-Service Breakdown

### 1. **Hosting: Vercel** (where your app runs)
**Cost:** $0–20/month (free tier includes everything you need)  
**What it does:** Runs your Next.js app 24/7. Handles traffic, manages deployments.

**What you need:**
- ✅ **Vercel account** (sign up at vercel.com with GitHub)
- ✅ **GitHub account** (your code lives here)

**Setup process:**
1. Create a GitHub account (github.com) — **free**
2. Push your code to GitHub (or I can help with this)
3. Sign up for Vercel with your GitHub account
4. Connect your GitHub repo to Vercel
5. Vercel auto-deploys every time you push code

**Annual cost:** $0 (free tier is plenty for a small shop)

---

### 2. **Database: PostgreSQL** (where orders and photos live)
**Cost:** $15–50/month (for a managed service)  
**What it does:** Stores customer orders, uploaded photos, artwork records.

**Three options:**

#### **Option A: Vercel Postgres** (EASIEST, $15/month minimum)
You get a PostgreSQL database managed by Vercel. One click in the Vercel dashboard.
- ✅ **No separate account needed** — just enable it in Vercel
- ✅ **Auto-backups, security handled**
- 📍 **Cost:** ~$15/month for hobby tier

#### **Option B: Railway.app** (GOOD VALUE, $5–20/month)
A newer hosting service, very developer-friendly.
- 📍 **Cost:** Pay-as-you-go, ~$5–10/month for small database
- ⚠️ **Requires separate account**

#### **Option C: Self-hosted on AWS RDS** (MORE COMPLEX, but cheaper at scale)
- 📍 **Cost:** $20/month minimum, but cheaper if you scale
- ⚠️ **More complicated to set up**

**Recommendation:** Start with **Vercel Postgres**. One-click setup, included in Vercel dashboard.

**What you need:**
- Connection string (Vercel gives this to you)
- Username/password (auto-generated)

---

### 3. **File Storage: Vercel Blob** (where pet photos live)
**Cost:** $5/month (includes 100 GB, you'll use ~1 GB/month)  
**What it does:** Stores uploaded pet photos, generated preview images.

**Setup:**
- ✅ **Enable in Vercel dashboard** (one click)
- ✅ **No separate account needed**

**What you need:**
- Blob token (Vercel gives this automatically)

---

### 4. **Email: Resend** (order confirmations, shipping updates)
**Cost:** $20/month (50,000 emails/month, or free tier with limited emails)  
**What it does:** Sends emails to customers when they order, when their package ships.

**Setup:**
1. Create account at resend.com
2. Verify your domain (kindredcreatures.com)
3. Copy API key to Vercel

**What you need:**
- ✅ **RESEND_API_KEY** (from resend.com dashboard)
- ✅ **Verified domain** (you probably own this already)

**Cost:** Free tier = 100 emails/day. Paid = $20/month for unlimited.

---

### 5. **Image Generation: OpenAI** (the AI portrait feature)
**Cost:** ~$0.02–0.05 per generated image (very cheap)  
**What it does:** Turns pet photos into artwork using `gpt-image-1`.

**Setup:**
1. Create account at openai.com
2. Add a payment method
3. Create an API key
4. Copy key to Vercel

**What you need:**
- ✅ **OPENAI_API_KEY** (from openai.com)
- ✅ **Credit card on file** (pay-as-you-go, ~$10/month even with heavy use)

**Cost breakdown:**
- Each preview generation: ~$0.02
- Each high-res print file: ~$0.05
- Customer does 3 tries per photo = ~$0.06 per customer
- 100 customers/month = ~$6/month

---

### 6. **Payments: PayFast** (South African payment gateway)
**Cost:** 2.5% + R1.50 per transaction  
**What it does:** Processes credit card and EFT payments. Money lands in your bank account.

**Setup:**
1. Apply for merchant account at payfast.co.za
2. Get approved (48 hours, South African bank account required)
3. Copy credentials to Vercel

**What you need:**
- ✅ **PAYFAST_MERCHANT_ID** (from PayFast dashboard)
- ✅ **PAYFAST_MERCHANT_KEY** (from PayFast dashboard)
- ✅ **PAYFAST_PASSPHRASE** (you set this)
- ✅ **PAYFAST_SANDBOX** (true for testing, false for live)

**Cost:** 2.5% + R1.50 per order (you only pay when someone buys)

---

## Credentials Checklist

### Environment Variables You Need to Set in Vercel

```
# Database (from Vercel Postgres or Railway)
DATABASE_URL=postgresql://user:password@host:5432/db

# Storage (from Vercel Blob)
BLOB_READ_WRITE_TOKEN=vercel_blob_xxx

# Email (from Resend)
RESEND_API_KEY=re_xxx

# Images (from OpenAI)
OPENAI_API_KEY=sk-proj-xxx

# Payments (from PayFast)
PAYFAST_MERCHANT_ID=12345678
PAYFAST_MERCHANT_KEY=xxxxxxxxxxxx
PAYFAST_PASSPHRASE=your-secret-passphrase
PAYFAST_SANDBOX=false  # Set to true for testing

# Admin login (you set this)
ADMIN_PASSWORD_HASH=...  # Generated once
ORDER_TOKEN_SECRET=random-secret-string

# Optional: RemoveBG (if you use auto-crop feature)
REMOVEBG_API_KEY=xxx
```

---

## Step-by-Step Deployment

### Week 1: Set Up Infrastructure

**Day 1: GitHub & Vercel**
```
1. Create GitHub account (github.com/signup)
2. Create Vercel account (vercel.com/signup with GitHub)
3. Link your GitHub repo to Vercel
   (I can help push the code to GitHub)
4. Enable "Automatic Deployments" (checked by default)
```

**Day 2: Database**
```
1. Go to your Vercel dashboard
2. Click "Storage" → "Create Database"
3. Select "Postgres"
4. Copy the connection string
5. Paste into Vercel environment variables as DATABASE_URL
```

**Day 3: File Storage**
```
1. Go to Vercel dashboard → "Storage"
2. Create "Vercel Blob" storage
3. Copy the token
4. Paste into Vercel as BLOB_READ_WRITE_TOKEN
```

**Day 4: Email**
```
1. Sign up at resend.com
2. Add your domain (kindredcreatures.com)
3. Verify DNS records (Resend guides you)
4. Create API key
5. Paste into Vercel as RESEND_API_KEY
```

**Day 5: OpenAI**
```
1. Sign up at openai.com/account/api-keys
2. Add payment method
3. Create API key
4. Paste into Vercel as OPENAI_API_KEY
```

**Day 6–7: PayFast**
```
1. Apply for merchant account at payfast.co.za
2. Wait for approval (48 hours)
3. Once approved, get your credentials
4. Paste into Vercel (PAYFAST_MERCHANT_ID, etc.)
5. Set PAYFAST_SANDBOX=true to test first
```

---

## How Deployment Actually Works

### Local Development (Your Computer)
```bash
npm run dev
# App runs at http://localhost:3000
# Uses local database (.data/pgdata)
# Uses local file storage (.data/uploads)
# No API calls to external services
```

### Pushing to Production
```bash
git add .
git commit -m "Update customer journey"
git push origin main
```

**What happens:**
1. GitHub receives your push
2. Vercel sees the push
3. Vercel runs `npm run build`
4. Vercel deploys to vercel.app
5. App connects to real database, blob storage, OpenAI, etc.
6. Your site is live in ~2 minutes

---

## Testing Before Going Live

### 1. Test on your local machine
```bash
npm run dev
# Upload a photo, try all 3 styles
# Test checkout (uses PayFast sandbox)
```

### 2. Test on Vercel preview (free)
Before pushing to `main`, push to a branch:
```bash
git push origin feature/customer-journey
```
Vercel creates a preview URL automatically. Test there.

### 3. Test with PayFast Sandbox
Set `PAYFAST_SANDBOX=true` in Vercel:
- Test transactions don't hit your real bank account
- Test every step of checkout flow
- Money doesn't leave the sandbox

### 4. Flip to Live
Once confident:
```bash
Set PAYFAST_SANDBOX=false in Vercel
npm run build && npm run start
# Real money now flows to your account
```

---

## Security Checklist

**Before you go live:**

- ☐ Set strong `ADMIN_PASSWORD_HASH` (for `/admin` login)
- ☐ Generate random `ORDER_TOKEN_SECRET`
- ☐ Use strong `PAYFAST_PASSPHRASE`
- ☐ Enable HTTPS (Vercel does this automatically)
- ☐ Set `NODE_ENV=production`
- ☐ Never commit `.env` or keys to GitHub (Vercel keeps them secret)
- ☐ Rotate PayFast passphrase every 6 months
- ☐ Enable 2FA on all service accounts (GitHub, Vercel, PayFast, etc.)

---

## Monthly Costs at Launch

| Service | Cost | Notes |
|---------|------|-------|
| Vercel Hosting | $0–20 | Free tier covers most traffic |
| Vercel Postgres | $15 | Minimum hobby tier |
| Vercel Blob | $5 | Includes 100 GB |
| Resend Email | $20 | Free tier = 50/day |
| OpenAI Images | $5–15 | ~$0.03 per image |
| PayFast | % of sales | 2.5% + R1.50 per transaction |
| Domain (DNS) | $0 | If you already own it |
| **TOTAL** | **$45–75/month** | +% of sales |

This is cheaper than most WordPress hosts + Shopify + email provider + payment gateway.

---

## Troubleshooting

### "DATABASE_URL is missing"
- You skipped the Vercel Postgres step
- Go to Vercel dashboard → Storage → Create Postgres

### "Images are not generating"
- OPENAI_API_KEY is wrong
- You haven't added a payment method to OpenAI
- Check OpenAI account status

### "Emails aren't sending"
- RESEND_API_KEY is wrong or expired
- Domain isn't verified in Resend dashboard
- Check spam folder (new domains often land there)

### "Payment form doesn't show"
- PAYFAST_MERCHANT_ID is wrong
- PAYFAST_SANDBOX mismatch (set to `true` for testing)
- Check browser console for errors

---

## What NOT to Do

❌ Don't install WordPress plugins — this isn't WordPress  
❌ Don't use FTP to upload files — push via Git  
❌ Don't store API keys in your code — use Vercel environment variables  
❌ Don't test with PAYFAST_SANDBOX=false first — always test in sandbox  
❌ Don't forget to set DATABASE_URL — database is not optional  

---

## Next Steps

1. **Create GitHub account** (5 minutes)
2. **Create Vercel account** (5 minutes)
3. **Push code to GitHub** (I can help — 10 minutes)
4. **Connect Vercel to GitHub** (5 minutes)
5. **Add each credential to Vercel** one at a time (20 minutes per service)
6. **Test locally first** (1 hour)
7. **Deploy to Vercel** (automatic)

Would you like me to walk you through any of these steps?
