# Production Readiness Checklist: Dispute2Go

Follow this checklist to transition from development to a live production environment.

## 1. Environment Variables (.env.production)

### Core
- [ ] `DATABASE_URL`: Production PostgreSQL connection string.
- [ ] `NEXTAUTH_SECRET`: Generate a new 32+ char secret.
- [ ] `NEXTAUTH_URL`: The public-facing URL of your app (e.g., `https://app.dispute2go.com`).
- [ ] `NODE_ENV`: Set to `production`.

### Stripe (Billing)
- [ ] `STRIPE_SECRET_KEY`: Live secret key from Stripe dashboard.
- [ ] `STRIPE_WEBHOOK_SECRET`: Live webhook secret (create a webhook pointing to `/api/billing/webhook`).
- [ ] `STRIPE_PRO_MONTHLY_PRICE_ID`: Live Price ID for the monthly Pro plan.
- [ ] `STRIPE_PRO_YEARLY_PRICE_ID`: Live Price ID for the yearly Pro plan.

### Email (Resend)
- [ ] `RESEND_API_KEY`: Production API key.
- [ ] `EMAIL_FROM`: Verified sender email (e.g., `Dispute2Go <onboarding@resend.dev>` or your custom domain).
- [ ] `EMAIL_REPLY_TO`: Your support email address.

### Physical Mail (Lob)
- [ ] `LOB_API_KEY`: Live API key (starts with `live_`).
- [ ] `LOB_TEST_MODE`: Set to `false`.

### AI Providers
- [ ] `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`: Production keys with sufficient credits/quota.

---

## 2. Third-Party Dashboard Configuration

### Stripe
- [ ] Create a **Subscription Product** named "Pro Plan".
- [ ] Create **Monthly** and **Yearly** prices.
- [ ] Configure **Branding** (Logo, Colors) in Stripe's Customer Portal settings.
- [ ] Add the production **Webhook URL** (`https://yourdomain.com/api/billing/webhook`) and subscribe to:
    - `checkout.session.completed`
    - `customer.subscription.deleted`
    - `customer.subscription.updated`
    - `invoice.payment_failed`

### Lob
- [ ] Add a **Payment Method** to your Lob account.
- [ ] Verify you have sufficient balance for certified mailings.

### Resend
- [ ] **Verify your custom domain** (DNS records) for better deliverability.

---

## 3. Data Integrity & Verification
- [ ] Run `npx prisma migrate deploy` on production DB.
- [ ] Run `npx prisma db seed` (ensure seed script is idempotent or only run once).
- [ ] Verify that the `Organization` table has correct default branding values for the first few users.
