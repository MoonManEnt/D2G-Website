# Dispute2Go Deployment Guide

## Prerequisites

- Node.js 18.x or higher
- PostgreSQL 14+ (Neon, Supabase, or self-hosted)
- Redis (optional, for rate limiting and caching)
- Stripe account (for billing)
- Resend or SendGrid account (for emails)

---

## Quick Start

### 1. Clone and Install

```bash
git clone <repo-url>
cd dispute2go
npm install
```

### 2. Environment Setup

```bash
# Copy the example environment file
cp .env.example .env

# Generate required secrets
openssl rand -base64 32  # For NEXTAUTH_SECRET
openssl rand -base64 32  # For JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # For ENCRYPTION_KEY
```

### 3. Database Setup

```bash
# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### 4. Build and Start

```bash
npm run build
npm start
```

---

## Critical Environment Variables

### 🔴 REQUIRED (App Won't Work Without These)

| Variable | Description | Generate With |
|----------|-------------|---------------|
| `DATABASE_URL` | PostgreSQL connection string | From your DB provider |
| `NEXTAUTH_SECRET` | Auth session encryption | `openssl rand -base64 32` |
| `JWT_SECRET` | Client portal JWT signing | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | PII field encryption (SSN, DOB) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### 🟠 IMPORTANT (Features Won't Work)

| Variable | Feature Affected |
|----------|-----------------|
| `STRIPE_SECRET_KEY` | Billing, subscriptions |
| `STRIPE_WEBHOOK_SECRET` | Payment event processing |
| `RESEND_API_KEY` | Email verification, notifications |
| `ANTHROPIC_API_KEY` | AMELIA AI letter generation |

---

## Security Checklist

### Before Going Live

- [ ] **Rotate all secrets** - Generate fresh values for production
- [ ] **Set ENCRYPTION_KEY** - Required for PII encryption at rest
- [ ] **Enable HTTPS** - Set `NEXTAUTH_URL` and `APP_URL` to https://
- [ ] **Configure CSP** - Review `next.config.js` Content-Security-Policy
- [ ] **Run security audit** - `npm audit` and fix vulnerabilities
- [ ] **Test rate limiting** - Ensure Redis is connected for production limits

### Secret Rotation

If you suspect secrets are compromised:

```bash
# 1. Generate new secrets
openssl rand -base64 32 > new_nextauth_secret.txt
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" > new_encryption_key.txt

# 2. Update environment variables in your deployment platform

# 3. Re-encrypt existing PII data (IMPORTANT!)
# Contact support for data re-encryption scripts
```

---

## Database Migrations

### Initial Setup

```bash
# Apply all migrations to a new database
npx prisma migrate deploy
```

### Development

```bash
# Create and apply a new migration
npx prisma migrate dev --name your_migration_name
```

### Production Updates

```bash
# Apply pending migrations (safe, non-destructive)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

---

## Deployment Platforms

### Vercel (Recommended)

1. Connect your GitHub repository
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push

```bash
# Manual deploy
vercel --prod
```

**Important Vercel Settings:**
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Docker

```dockerfile
# Dockerfile (create at project root)
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npx prisma generate
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]
```

```bash
# Build and run
docker build -t dispute2go .
docker run -p 3000:3000 --env-file .env dispute2go
```

---

## Stripe Configuration

### 1. Create Products and Prices

In Stripe Dashboard, create:
- **Starter Plan**: $29/month or $290/year
- **Professional Plan**: $79/month or $790/year

### 2. Set Price IDs

```env
STRIPE_STARTER_MONTHLY_PRICE_ID=price_xxx
STRIPE_STARTER_YEARLY_PRICE_ID=price_xxx
STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID=price_xxx
STRIPE_PROFESSIONAL_YEARLY_PRICE_ID=price_xxx
```

### 3. Configure Webhook

1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

---

## Monitoring & Logging

### Sentry Setup

1. Create project at sentry.io
2. Set environment variables:

```env
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=dispute2go
SENTRY_AUTH_TOKEN=your-auth-token
```

### Structured Logging

The app uses Pino for structured logging. In production:

```bash
# View logs with pino-pretty (development)
npm start | npx pino-pretty

# In production, pipe to your log aggregator
npm start | your-log-aggregator
```

---

## Backup & Recovery

### Database Backups

For Neon/Supabase, backups are automatic. For self-hosted:

```bash
# Daily backup script
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup_20250216.sql
```

### File Storage Backups

If using S3/R2:
```bash
# Sync to backup bucket
aws s3 sync s3://dispute2go-uploads s3://dispute2go-backups
```

---

## Troubleshooting

### Common Issues

**Build fails with undici error:**
```bash
# Ensure package.json has the override
"overrides": {
  "undici": "5.28.4"
}

# Reinstall dependencies
rm -rf node_modules && npm install
```

**Prisma client not generated:**
```bash
npx prisma generate
```

**Missing DisputeDraft table:**
```bash
npx prisma migrate deploy
```

**PII fields showing as encrypted:**
```bash
# Ensure ENCRYPTION_KEY is set in environment
# The same key must be used consistently
```

### Health Check

Test your deployment:
```bash
curl https://yourdomain.com/api/health
# Should return: {"status":"ok","database":"connected"}
```

---

## Support

For deployment issues:
- GitHub Issues: https://github.com/your-org/dispute2go/issues
- Email: support@dispute2go.com
