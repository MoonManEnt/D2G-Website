# Dispute2Go -- Backup & Disaster Recovery

This document covers backup strategies, disaster recovery procedures, and monitoring for the Dispute2Go application.

**Tech stack:** Next.js on Vercel, Neon PostgreSQL, S3/R2/local file storage, Stripe, Sentry, Redis.

---

## Table of Contents

1. [Database Backups (Neon PostgreSQL)](#1-database-backups-neon-postgresql)
2. [File Storage Backups](#2-file-storage-backups)
3. [Environment & Configuration](#3-environment--configuration)
4. [Disaster Recovery Plan](#4-disaster-recovery-plan)
5. [Monitoring & Alerts](#5-monitoring--alerts)

---

## 1. Database Backups (Neon PostgreSQL)

### 1.1 Automatic Point-in-Time Recovery (PITR)

Neon provides automatic PITR on the **Pro plan** with the following characteristics:

- **Retention:** 7 days of history (configurable up to 30 days on Enterprise)
- **Granularity:** Restore to any point in time within the retention window
- **Access:** Via the Neon Console under **Project > Branches > Restore**

To restore to a specific point in time:

1. Open the Neon Console at [console.neon.tech](https://console.neon.tech)
2. Navigate to your project and select **Branches**
3. Click **Restore** and choose the target timestamp
4. Neon creates a new branch from that point; update `DATABASE_URL` accordingly

### 1.2 Manual Backups with pg_dump

For portable backups independent of Neon's retention window, use `pg_dump`:

```bash
# Export as a plain SQL file
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --format=plain \
  --file="dispute2go_backup_$(date +%Y%m%d_%H%M%S).sql"

# Export as a compressed custom-format archive (recommended for large databases)
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --format=custom \
  --file="dispute2go_backup_$(date +%Y%m%d_%H%M%S).dump"
```

> **Note:** Your `DATABASE_URL` is in the format `postgresql://user:password@host:5432/dbname?sslmode=require`. Always use `sslmode=require` for Neon connections.

### 1.3 Restoring from Backup

**From a plain SQL file:**

```bash
psql "$NEW_DATABASE_URL" < dispute2go_backup_20250101_120000.sql
```

**From a custom-format archive:**

```bash
pg_restore \
  --no-owner \
  --no-privileges \
  --dbname="$NEW_DATABASE_URL" \
  dispute2go_backup_20250101_120000.dump
```

After restoring, always run Prisma migrations to ensure schema alignment:

```bash
npx prisma migrate deploy
```

### 1.4 Automated Weekly Backup to S3

Set up a GitHub Actions workflow or cron job to run `pg_dump` weekly and upload to S3.

**GitHub Actions example** (`.github/workflows/db-backup.yml`):

```yaml
name: Weekly Database Backup

on:
  schedule:
    # Every Sunday at 3:00 AM UTC
    - cron: "0 3 * * 0"
  workflow_dispatch: # Allow manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Install PostgreSQL client
        run: sudo apt-get update && sudo apt-get install -y postgresql-client

      - name: Create backup
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          FILENAME="dispute2go_backup_$(date +%Y%m%d_%H%M%S).dump"
          pg_dump "$DATABASE_URL" \
            --no-owner \
            --no-privileges \
            --format=custom \
            --file="$FILENAME"
          echo "BACKUP_FILE=$FILENAME" >> $GITHUB_ENV

      - name: Upload to S3
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.BACKUP_AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.BACKUP_AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: ${{ secrets.BACKUP_AWS_REGION }}
        run: |
          aws s3 cp "$BACKUP_FILE" \
            "s3://dispute2go-backups/database/$BACKUP_FILE" \
            --storage-class STANDARD_IA

      - name: Clean up old backups (keep last 12 weeks)
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.BACKUP_AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.BACKUP_AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: ${{ secrets.BACKUP_AWS_REGION }}
        run: |
          # List and delete backups older than 84 days
          aws s3 ls s3://dispute2go-backups/database/ \
            | awk '{print $4}' \
            | while read file; do
                file_date=$(echo "$file" | grep -oP '\d{8}')
                if [ -n "$file_date" ]; then
                  file_epoch=$(date -d "$file_date" +%s 2>/dev/null || echo 0)
                  cutoff_epoch=$(date -d "-84 days" +%s)
                  if [ "$file_epoch" -lt "$cutoff_epoch" ] && [ "$file_epoch" -gt 0 ]; then
                    aws s3 rm "s3://dispute2go-backups/database/$file"
                    echo "Deleted old backup: $file"
                  fi
                fi
              done
```

**Cron script alternative** (`scripts/backup-db.sh`):

```bash
#!/usr/bin/env bash
set -euo pipefail

# Load environment
source /path/to/.env.production

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/dispute2go-backups"
FILENAME="dispute2go_backup_${TIMESTAMP}.dump"
S3_BUCKET="s3://dispute2go-backups/database"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup..."

pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --format=custom \
  --file="${BACKUP_DIR}/${FILENAME}"

echo "[$(date)] Uploading to S3..."
aws s3 cp "${BACKUP_DIR}/${FILENAME}" "${S3_BUCKET}/${FILENAME}" \
  --storage-class STANDARD_IA

echo "[$(date)] Cleaning up local file..."
rm -f "${BACKUP_DIR}/${FILENAME}"

echo "[$(date)] Backup complete: ${FILENAME}"
```

Add to crontab:

```
# Weekly backup every Sunday at 3:00 AM
0 3 * * 0 /path/to/scripts/backup-db.sh >> /var/log/dispute2go-backup.log 2>&1
```

---

## 2. File Storage Backups

Dispute2Go supports three storage providers (configured via `STORAGE_PROVIDER`):

| Provider | Env Var | Bucket / Path |
|----------|---------|---------------|
| `local`  | `UPLOAD_DIR` (default: `./uploads`) | Local filesystem |
| `s3`     | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | `STORAGE_BUCKET` (default: `dispute2go-uploads`) |
| `r2`     | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | `STORAGE_BUCKET` (default: `dispute2go-uploads`) |

Files are stored with the key pattern: `{organizationId}/{type}/{timestamp}-{random}.{ext}` where `type` is one of `reports`, `evidence`, `documents`, or `profiles`.

### 2.1 AWS S3 -- Recommended Backup Configuration

1. **Enable versioning** on the bucket:
   ```bash
   aws s3api put-bucket-versioning \
     --bucket dispute2go-uploads \
     --versioning-configuration Status=Enabled
   ```

2. **Enable cross-region replication** for geographic redundancy:
   - Create a destination bucket in a different region (e.g., `dispute2go-uploads-replica` in `us-west-2`)
   - Configure a replication rule in the source bucket to replicate all objects

3. **Set up lifecycle rules** to manage storage costs:
   ```bash
   aws s3api put-bucket-lifecycle-configuration \
     --bucket dispute2go-uploads \
     --lifecycle-configuration '{
       "Rules": [
         {
           "ID": "TransitionToIA",
           "Status": "Enabled",
           "Filter": {},
           "Transitions": [
             {
               "Days": 90,
               "StorageClass": "STANDARD_IA"
             }
           ],
           "NoncurrentVersionExpiration": {
             "NoncurrentDays": 30
           }
         }
       ]
     }'
   ```

### 2.2 Cloudflare R2 -- Recommended Backup Configuration

- R2 does not currently support native cross-region replication
- Set up a daily sync job to a secondary R2 bucket or an S3 bucket:
  ```bash
  # Sync R2 to a backup S3 bucket using rclone
  rclone sync r2:dispute2go-uploads s3:dispute2go-uploads-backup --transfers 16
  ```
- Enable object versioning via the R2 dashboard or API

### 2.3 Local Storage -- Backup with rsync

If running with `STORAGE_PROVIDER="local"`, files are stored in the `UPLOAD_DIR` directory (default `./uploads`):

```bash
# Sync to a remote backup location
rsync -avz --delete \
  /path/to/dispute2go/uploads/ \
  backup-server:/backups/dispute2go-uploads/

# Or sync to an S3 bucket
aws s3 sync /path/to/dispute2go/uploads/ s3://dispute2go-backups/uploads/
```

> **Warning:** Local storage on Vercel is ephemeral. If deploying to Vercel, you must use `s3` or `r2` as the storage provider. Local storage is only suitable for self-hosted or development environments.

---

## 3. Environment & Configuration

### 3.1 Secrets Management

All environment variables should be stored in a secure vault, never in source control.

**Recommended storage options (pick one):**

| Approach | Best For |
|----------|----------|
| **Vercel Environment Variables** | Production deployments on Vercel (built-in, encrypted at rest) |
| **AWS Secrets Manager** | Self-hosted or multi-cloud setups |
| **1Password / Bitwarden** | Team access and sharing (use CLI for CI/CD integration) |
| **Doppler** | Centralized secrets management across environments |

### 3.2 Required Environment Variables

The full list is maintained in `.env.example`. The critical production variables are:

**Core (required):**
- `DATABASE_URL` -- Neon PostgreSQL connection string
- `NEXTAUTH_SECRET` -- Session signing key (min 32 characters)
- `NEXTAUTH_URL` -- Canonical application URL
- `JWT_SECRET` -- Client portal token signing key
- `ENCRYPTION_KEY` -- 256-bit hex key for PII encryption (SSN, DOB, phone, address)

**Payments:**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`, `STRIPE_ENTERPRISE_PRICE_ID`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

**File Storage (if not using local):**
- `STORAGE_PROVIDER` -- `s3` or `r2`
- `STORAGE_BUCKET`
- S3: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`

**Email & SMS:**
- `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

**AI/LLM:**
- `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY`
- `DEFAULT_LLM_PROVIDER` -- `claude` or `openai`

**Monitoring:**
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`

**Redis:**
- `REDIS_URL` (or `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`)

### 3.3 Backup Procedure for Env Vars

1. Export current Vercel env vars:
   ```bash
   vercel env ls
   vercel env pull .env.production.backup
   ```
2. Store the backup file in your secure vault (not in git)
3. Document any manual rotation schedule (recommended: quarterly for API keys, annually for signing secrets)

---

## 4. Disaster Recovery Plan

### 4.1 Recovery Objectives

| Metric | Target | Notes |
|--------|--------|-------|
| **RTO** (Recovery Time Objective) | **1 hour** | Time from incident to fully operational |
| **RPO** (Recovery Point Objective) | **24 hours** (standard) / **minutes** (with Neon PITR) | Maximum acceptable data loss window |

### 4.2 Full Recovery Procedure

Follow these steps in order if the production environment is completely lost:

#### Step 1: Provision a New Neon Database

1. Log in to [console.neon.tech](https://console.neon.tech)
2. Create a new project (or restore from PITR if the project still exists)
3. Note the new `DATABASE_URL` connection string

#### Step 2: Restore Data

**Option A -- Neon PITR (preferred, RPO = minutes):**
- In the Neon Console, select the project and use **Restore** to create a branch from the desired point in time
- The restored branch gets a new connection string

**Option B -- From pg_dump backup (RPO = last backup):**
```bash
# Download the latest backup from S3
aws s3 cp s3://dispute2go-backups/database/latest.dump ./latest.dump

# Restore to the new database
pg_restore \
  --no-owner \
  --no-privileges \
  --dbname="$NEW_DATABASE_URL" \
  ./latest.dump
```

#### Step 3: Run Prisma Migrations

Ensure the schema is current:

```bash
npx prisma migrate deploy
```

If there are pending migrations that were not in the backup, this will apply them.

#### Step 4: Update Vercel Environment Variables

```bash
# Update the DATABASE_URL
vercel env rm DATABASE_URL production
echo "$NEW_DATABASE_URL" | vercel env add DATABASE_URL production

# Update any other changed variables as needed
```

#### Step 5: Redeploy

```bash
# Trigger a production deployment
vercel --prod
```

Or push to the main branch to trigger an automatic deployment.

#### Step 6: Verify

1. Check the health endpoint:
   ```bash
   curl -s https://your-domain.com/api/health | jq .
   ```
   Expected response:
   ```json
   {
     "status": "healthy",
     "checks": {
       "database": { "status": "ok", "latency": 12 },
       "environment": { "status": "ok" }
     }
   }
   ```

2. Verify critical flows:
   - User login (NextAuth)
   - Client list loads (database read)
   - File upload/download (storage)
   - Stripe webhook connectivity (check Stripe Dashboard > Webhooks)

### 4.3 Rollback Procedure for Bad Deployments

Vercel maintains a history of all deployments. To roll back:

**Via Vercel CLI:**
```bash
# List recent deployments
vercel ls

# Promote a previous deployment to production
vercel promote <deployment-url>
```

**Via Vercel Dashboard:**
1. Go to the project on [vercel.com](https://vercel.com)
2. Navigate to **Deployments**
3. Find the last known good deployment
4. Click the three-dot menu and select **Promote to Production**

**Database rollback (if a migration caused issues):**

Prisma does not support automatic migration rollback. Options:

1. Restore the database from the pre-migration backup or PITR timestamp
2. Write and apply a manual reverse migration
3. Use `prisma migrate resolve --rolled-back <migration_name>` to mark the migration as rolled back, then apply a corrective migration

### 4.4 Incident Response Checklist

- [ ] Identify the scope of the outage (full vs. partial)
- [ ] Check Vercel status page: [vercel.com/status](https://vercel.com/status)
- [ ] Check Neon status page: [neon.tech/status](https://neon.tech/status)
- [ ] Check the `/api/health` endpoint for specific failure details
- [ ] If database is down: follow Steps 1-3 above
- [ ] If Vercel is down: wait for platform recovery (no action needed)
- [ ] If storage is down: check S3/R2 status; files are not served through Vercel
- [ ] Notify affected users via status page or email
- [ ] Document the incident in a post-mortem within 48 hours

---

## 5. Monitoring & Alerts

### 5.1 Health Check Endpoint

The application exposes a health check at:

```
GET /api/health
```

This endpoint verifies:
- **Database connectivity** -- runs `SELECT 1` against Neon PostgreSQL and reports latency
- **Environment** -- checks that `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` are set

Response codes:
- `200` -- All checks pass (`status: "healthy"`)
- `503` -- One or more checks fail (`status: "degraded"`)

A metrics endpoint is also available at `GET /api/health/metrics`.

### 5.2 Uptime Monitoring

Set up external uptime monitoring to detect outages before users report them.

**Recommended services:**

| Service | Free Tier | Interval |
|---------|-----------|----------|
| [UptimeRobot](https://uptimerobot.com) | 50 monitors, 5 min | 5 min (free), 1 min (paid) |
| [Better Uptime](https://betteruptime.com) | 10 monitors, 3 min | 3 min (free), 30s (paid) |
| [Vercel Monitoring](https://vercel.com/docs/monitoring) | Included with Pro | Continuous |

**Configuration:**
- Monitor URL: `https://your-domain.com/api/health`
- Expected status code: `200`
- Alert channels: Email, Slack, PagerDuty
- Check interval: 1-3 minutes

### 5.3 Sentry Error Tracking

Sentry is configured via these environment variables:

```
NEXT_PUBLIC_SENTRY_DSN=<your-dsn>
SENTRY_ORG=<your-org>
SENTRY_PROJECT=<your-project>
SENTRY_AUTH_TOKEN=<your-token>
```

**Recommended alert rules in Sentry:**
- Alert on any new unhandled exception
- Alert if error rate exceeds 10 errors/minute
- Alert on first occurrence of any new issue
- Set up weekly email digest for error trends

### 5.4 Stripe Webhook Monitoring

Stripe webhook failures can cause missed payment events, subscription state drift, and billing issues.

**Monitor in the Stripe Dashboard:**
1. Go to **Developers > Webhooks**
2. Check the **Recent events** tab for failed deliveries
3. Enable email alerts for repeated webhook failures

**Recommended actions:**
- Set up a Stripe webhook endpoint health check
- Monitor the `STRIPE_WEBHOOK_SECRET` rotation schedule
- Review failed webhooks weekly and replay any that were missed

### 5.5 Redis Monitoring

If using Redis for rate limiting, caching, or queues:

- Monitor memory usage and eviction rate
- Set up alerts for connection failures
- Use `redis-cli info` or a dashboard like RedisInsight

### 5.6 Alert Escalation Matrix

| Severity | Example | Response Time | Channel |
|----------|---------|---------------|---------|
| **P0 -- Critical** | Full outage, data loss | 15 minutes | PagerDuty + Phone |
| **P1 -- High** | Degraded (DB slow, storage errors) | 1 hour | Slack + Email |
| **P2 -- Medium** | Non-critical feature broken | 4 hours | Slack |
| **P3 -- Low** | Cosmetic issue, minor bug | Next business day | Email |

---

## Appendix: Quick Reference Commands

```bash
# Create a database backup
pg_dump "$DATABASE_URL" --no-owner --format=custom --file="backup_$(date +%Y%m%d).dump"

# Restore a database backup
pg_restore --no-owner --dbname="$DATABASE_URL" backup_20250101.dump

# Apply pending Prisma migrations
npx prisma migrate deploy

# Check application health
curl -s https://your-domain.com/api/health | jq .

# List Vercel deployments
vercel ls

# Roll back to a previous deployment
vercel promote <deployment-url>

# Pull current Vercel env vars for backup
vercel env pull .env.production.backup

# Sync local uploads to S3
aws s3 sync ./uploads/ s3://dispute2go-backups/uploads/
```
