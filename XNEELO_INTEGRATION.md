# Xneelo Integration: Hosting Options

Good news: You can use your existing Xneelo account to reduce hosting costs. The question is **how much** you can use it, which depends on your plan type.

---

## What Type of Xneelo Account Do You Have?

Check your Xneelo dashboard. Look for one of these:

### **Shared Hosting** (most common)
- ✅ Can host static files (HTML, CSS, images)
- ✅ Can use for DNS/domain management
- ❌ **Cannot** run Node.js apps (Next.js requires Node.js)
- 📍 Good for: Domain, static assets, redirects

### **VPS Hosting** (more powerful)
- ✅ Can run Node.js
- ✅ Full control over the server
- ⚠️ **You manage everything** (security, updates, backups)
- 📍 Good for: Running the entire Next.js app

### **Managed WordPress Hosting**
- ❌ Not suitable for this app
- 📍 This hosting is WordPress-only

---

## Option 1: Shared Hosting (Most Cost-Effective)

If you have **shared hosting**, use this hybrid approach:

```
Your Domain (Xneelo DNS)
    ↓
    ├─ www.kindredcreatures.com → Vercel (app)
    ├─ Static assets → Xneelo (images, fonts, CSS)
    └─ Email/DNS → Xneelo (you already pay for this)
```

**Setup:**
1. Point your Xneelo DNS to Vercel
2. Use Xneelo FTP to upload static files
3. App runs on Vercel (you're already paying Xneelo for domain, so no extra cost)

**Cost comparison:**
- **Before:** Xneelo (domain) + Vercel (hosting) = ~R150/mo + $20/mo
- **After:** Xneelo (domain, DNS, static) + Vercel (app) = ~R150/mo + $20/mo
- **Savings:** $0 (but you're using your existing Xneelo)

**How to set it up:**

1. **Point your domain to Vercel:**
   - Log into Xneelo control panel
   - Find "DNS Management" or "Name Servers"
   - Add Vercel nameservers (Vercel gives you these):
     ```
     ns1.vercel-dns.com
     ns2.vercel-dns.com
     ns3.vercel-dns.com
     ns4.vercel-dns.com
     ```
   - Wait 24 hours for DNS to propagate

2. **Optional: Store static assets on Xneelo**
   - Upload files via FTP: images, fonts, icons
   - Reference them in your Next.js app:
     ```typescript
     <img src="https://assets.kindredcreatures.com/pet-icon.svg" />
     ```
   - This saves bandwidth from Vercel Blob

---

## Option 2: VPS Hosting (Full Control, More Work)

If you have **VPS hosting**, you can run the entire app on Xneelo and skip Vercel.

**Setup:**
1. SSH into your Xneelo VPS
2. Install Node.js, PostgreSQL, etc.
3. Deploy the Next.js app directly
4. Use PM2 or systemd to keep it running

**Pros:**
- ✅ Full control
- ✅ Everything in one place (you already pay Xneelo)
- ✅ No vendor lock-in to Vercel

**Cons:**
- ❌ You manage security patches, backups, uptime
- ❌ More complex deployment (no auto-git-push)
- ❌ You're responsible if the server goes down
- ❌ Slower than Vercel's global CDN

**Cost:**
- Xneelo VPS: ~R300–500/mo (you might already be paying this)
- Database: Run PostgreSQL on same VPS (free)
- Storage: Use local disk (free)
- Email: Xneelo email (already included?)
- **Total:** ~R300–500/mo (if already paying for VPS)

**I'd only recommend this if:**
- You're technically comfortable with SSH/Linux
- Your VPS is powerful enough (2+ GB RAM, 20+ GB storage)
- You want everything under one roof

---

## Option 3: Hybrid (Recommended for Your Situation)

**Use Xneelo for some things, Vercel for others:**

```
Xneelo:
├─ Domain + DNS (you're already paying)
├─ Email service (if you have it)
└─ Static assets / CDN (optional)

Vercel:
├─ Next.js app hosting
├─ PostgreSQL database
├─ Image generation (OpenAI)
└─ Payment processing (PayFast)
```

**Why this is best:**
- ✅ Uses your existing Xneelo investment
- ✅ Vercel handles the hard parts (deployment, auto-scaling)
- ✅ You don't have to manage a VPS
- ✅ Most reliable setup

**Cost:**
- Xneelo: ~R150/mo (domain, DNS, email — already paid)
- Vercel: ~$45/mo (hosting, database, storage)
- **Total:** ~R150 + $45/mo = ~R925/mo (vs. R1,500 for everything on Xneelo)

---

## Step-by-Step: Using Your Xneelo Domain with Vercel

### **Step 1: Update Xneelo DNS**

1. Log into Xneelo control panel
2. Go to **Domains** → your domain → **DNS Management**
3. You'll see current nameservers (probably pointing to Xneelo)
4. Change them to Vercel's:
   ```
   ns1.vercel-dns.com
   ns2.vercel-dns.com
   ns3.vercel-dns.com
   ns4.vercel-dns.com
   ```
5. Save and wait 24–48 hours

### **Step 2: Tell Vercel About Your Domain**

1. Go to Vercel dashboard
2. Select your project
3. Go to **Settings** → **Domains**
4. Add your domain: `kindredcreatures.com`
5. Vercel will verify DNS ownership automatically

### **Step 3: (Optional) Migrate Email**

If Xneelo hosts your email:
- Keep using Xneelo for email accounts
- Use Resend for transactional email (order confirmations)
- They don't conflict

**Email setup:**
```
kindredcreatures.com
├─ MX records → Xneelo (for your staff email: hello@kindredcreatures.com)
└─ No conflict with transactional email from Resend
```

---

## What About Database Hosting on Xneelo?

**Can I run PostgreSQL on Xneelo VPS instead of Vercel?**

Yes, but with caveats:

- ✅ VPS can host PostgreSQL
- ✅ Saves $15/month (Vercel Postgres cost)
- ❌ You're responsible for backups, security patches, uptime
- ❌ Must manage database manually

**I'd recommend:** Use Vercel Postgres unless you're already running a VPS and comfortable with database administration. The $15/month is worth the peace of mind.

---

## What About File Storage on Xneelo?

**Can I use Xneelo disk space instead of Vercel Blob?**

Technically yes, but not ideal:

- ✅ Xneelo has plenty of disk space
- ❌ Serving files from Xneelo is slower than Vercel Blob (global CDN)
- ❌ Managing uploads/deletes is manual
- ❌ No built-in security features

**Better option:** Use Vercel Blob ($5/mo) or AWS S3 ($1–2/mo). The speed improvement is worth it for an e-commerce site.

---

## DNS Setup: The Right Way

When everything is configured, your DNS should look like this:

```
NAMESERVERS (at Xneelo):
ns1.vercel-dns.com
ns2.vercel-dns.com
ns3.vercel-dns.com
ns4.vercel-dns.com

A Records (managed by Vercel):
kindredcreatures.com → Vercel IP
www.kindredcreatures.com → Vercel IP

MX Records (if using Xneelo email):
10 mail.xneelo.co.za (or your Xneelo mail server)

TXT Records (for email/verification):
SPF: v=spf1 include:xneelo.co.za ~all
DKIM: (from your email provider)
DMARC: v=DMARC1; p=none
```

---

## Pricing Summary: Three Scenarios

### **Scenario A: Shared Hosting at Xneelo**
```
Xneelo shared hosting:     R150/mo (includes domain, DNS, email)
Vercel app hosting:        $20/mo  (~R360/mo)
Vercel Postgres:          $15/mo  (~R270/mo)
Vercel Blob storage:      $5/mo   (~R90/mo)
Resend email:             $20/mo  (~R360/mo)
OpenAI images:            $10/mo  (~R180/mo)
PayFast:                  % of sales
─────────────────────────────────────────
TOTAL:                    ~R1,410/mo + % of sales
```

### **Scenario B: VPS at Xneelo (Full Control)**
```
Xneelo VPS:               R400/mo (includes domain, DNS, app, database)
Resend email:             $20/mo  (~R360/mo)
OpenAI images:            $10/mo  (~R180/mo)
PayFast:                  % of sales
─────────────────────────────────────────
TOTAL:                    ~R940/mo + % of sales
(But you manage security, backups, uptime yourself)
```

### **Scenario C: Hybrid (RECOMMENDED)**
```
Xneelo domain/DNS:        R150/mo (you're already paying)
Vercel app hosting:       $20/mo  (~R360/mo)
Vercel Postgres:          $15/mo  (~R270/mo)
Vercel Blob:              $5/mo   (~R90/mo)
Resend email:             $20/mo  (~R360/mo)
OpenAI images:            $10/mo  (~R180/mo)
PayFast:                  % of sales
─────────────────────────────────────────
TOTAL:                    ~R1,410/mo + % of sales
(But you get Vercel's reliability, auto-scaling, backups)
```

---

## How to Check Your Xneelo Plan

**Log into Xneelo:**
1. Go to xneelo.co.za
2. Log into your account
3. Click on **Services** or **My Packages**
4. Look for:
   - "Shared Hosting" = Option 1
   - "VPS" or "Virtual Private Server" = Option 2
   - "Dedicated Server" = Option 2 (even more powerful)

If you're not sure, **take a screenshot and send it to me** — I can tell you exactly what you can do.

---

## My Recommendation

**Use the Hybrid approach (Option 3):**

1. **Point your Xneelo domain to Vercel** (one-time, 5 minutes)
2. **Everything else runs on Vercel/external services**
3. **You keep paying Xneelo for domain** (already doing this)
4. **You add Vercel's services** (~$45/mo)

**Why:**
- ✅ Leverages your existing Xneelo investment
- ✅ Vercel is rock-solid for e-commerce (auto-scale, backups, CDN)
- ✅ No VPS headaches (you don't have to manage server updates, security patches, database maintenance)
- ✅ Clear separation: domain at Xneelo, app at Vercel
- ✅ If Vercel has issues, your domain still works
- ✅ If you outgrow Vercel, easy to migrate

---

## Next Steps

1. **Tell me what type of Xneelo account you have** (shared? VPS? unsure?)
2. **I'll create the exact DNS configuration** for your domain
3. **You change your nameservers at Xneelo** (one-time, 5 minutes)
4. **Everything else is automatic**

Want to go with this approach?
