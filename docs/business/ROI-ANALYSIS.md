# Dispute2Go ROI & Pricing Strategy Analysis

## Executive Summary

This document analyzes the operational costs of running Dispute2Go at scale and provides pricing strategy recommendations. The analysis covers three scale tiers and evaluates various pricing models to ensure sustainable unit economics.

**Key Findings:**
1. AI/LLM costs are ~$0.03-0.05 per letter (predictable, scalable)
2. Mail/postage is the largest variable cost (~$3-5/client/month)
3. Infrastructure costs are largely fixed, creating economies of scale
4. Minimum viable pricing: ~$15-25/user depending on scale

---

## Scale Tier Analysis

### Tier 1: Startup (100 Users, 1,000 Clients)

| Cost Category | Monthly Cost | Per User | Per Client |
|---------------|-------------|----------|------------|
| AI/LLM (AMELIA) | $150-250 | $1.50-2.50 | $0.15-0.25 |
| Mail/Postage | $3,000-4,500 | $30-45 | $3.00-4.50 |
| Infrastructure | $200-400 | $2-4 | $0.20-0.40 |
| **Total** | **$3,350-5,150** | **$33.50-51.50** | **$3.35-5.15** |

**Breakeven:** $40-60/user at flat rate pricing

---

### Tier 2: Growth (1,000 Users, 10,000 Clients)

| Cost Category | Monthly Cost | Per User | Per Client |
|---------------|-------------|----------|------------|
| AI/LLM (AMELIA) | $1,500-2,500 | $1.50-2.50 | $0.15-0.25 |
| Mail/Postage | $30,000-45,000 | $30-45 | $3.00-4.50 |
| Infrastructure | $700-1,200 | $0.70-1.20 | $0.07-0.12 |
| **Total** | **$32,200-48,700** | **$32.20-48.70** | **$3.22-4.87** |

**Breakeven:** $35-55/user at flat rate pricing

---

### Tier 3: Scale (10,000 Users, 100,000 Clients)

| Cost Category | Monthly Cost | Per User | Per Client |
|---------------|-------------|----------|------------|
| AI/LLM (AMELIA) | $15,000-25,000 | $1.50-2.50 | $0.15-0.25 |
| Mail/Postage | $300,000-450,000 | $30-45 | $3.00-4.50 |
| Infrastructure | $3,000-5,000 | $0.30-0.50 | $0.03-0.05 |
| **Total** | **$318,000-480,000** | **$31.80-48.00** | **$3.18-4.80** |

**Breakeven:** $35-50/user at flat rate pricing

---

## Cost Breakdown Deep Dive

### AI/LLM Costs (AMELIA v4)

AMELIA v4 uses Claude for 100% AI-generated letters. Cost breakdown:

```
Per Letter:
- Input tokens:  ~5,000 tokens  = $0.015 (Claude Sonnet)
- Output tokens: ~2,500 tokens  = $0.0375 (Claude Sonnet)
- Retry (30%):   ~2,000 tokens  = $0.003 (Claude Haiku)
- TOTAL:         ~$0.05-0.06 per letter

Per Client (3 letters/month):
- Standard:      ~$0.15-0.18/month
- Heavy user:    ~$0.25-0.30/month
```

**Cost Optimization Options:**
1. Use Claude Haiku for simpler letters (70% cost reduction)
2. Batch similar letters to share context
3. Cache legal frameworks and templates
4. Use GPT-4o-mini as fallback ($0.01/letter)

---

### Mail/Postage Costs

This is the **largest variable cost** and most impactful on unit economics.

| Service | Cost Per Piece | Certified | Notes |
|---------|---------------|-----------|-------|
| DocuPost | $0.55 | $4.50 | Recommended |
| Lob | $0.63 | $5.75 | Enterprise features |
| Self-mail | $0.68 | $7.50 | Manual, time-intensive |

**Typical Client Usage:**
- 6 pieces/month standard @ $0.55 = $3.30
- 1 certified/month @ $4.50 = $4.50
- **Total: ~$3.30-7.80/client/month**

**Strategy Recommendation:**
Mail costs should be passed through to customers with markup:
- Standard handling: 20% markup
- Certified handling: 15% markup
- This is industry standard and expected

---

### Infrastructure Costs

| Component | Starter | Growth | Scale |
|-----------|---------|--------|-------|
| Vercel Hosting | $40 | $100 | $200 |
| Database (Neon/Supabase) | $25 | $600 | $2,000 |
| Storage (R2) | $5 | $50 | $500 |
| Email (Resend) | $0 | $20 | $200 |
| Monitoring (Sentry) | $29 | $100 | $500 |
| **Total** | **$99** | **$870** | **$3,400** |

**Key Insight:** Infrastructure costs are largely fixed. At scale, per-user costs approach $0.30-0.50/month.

---

## Pricing Model Comparison

### Model 1: Flat Rate

```
Starter:      $49/month  (25 clients max)
Professional: $99/month  (100 clients max)
Business:     $199/month (500 clients max)
Enterprise:   $499/month (unlimited)
```

**Pros:** Simple, predictable revenue, easy to sell
**Cons:** Users gaming limits, unpredictable costs at heavy usage

**Margin Analysis (1,000 users):**
- Revenue: $99,000/month
- Costs: ~$35,000/month (excl. mail passthrough)
- Margin: ~65%

---

### Model 2: Per-Client Pricing

```
Base:         $29/month
Per Client:   $3/month (active clients only)
```

**Example:** User with 50 clients = $29 + (50 x $3) = $179/month

**Pros:** Scales with customer success, fair value exchange
**Cons:** Revenue unpredictable, customers may limit clients

**Margin Analysis (1,000 users, 10 clients avg):**
- Revenue: $59,000/month
- Costs: ~$35,000/month
- Margin: ~40%

---

### Model 3: Usage-Based Hybrid (Recommended)

```
Base:           $29/month
Per Client:     $2/month
Per AI Letter:  $0.15/letter
Mail:           At-cost + 20%
```

**Example:** User with 50 clients, 150 letters, $300 mail
- Base: $29
- Clients: $100
- AI Letters: $22.50
- Mail: $360
- **Total: $511.50/month**

**Pros:**
- Aligns costs with revenue perfectly
- Transparent, customers can calculate
- Rewards efficiency
- Covers AI costs with markup

**Cons:**
- More complex billing
- Customers may feel nickel-and-dimed

**Margin Analysis (1,000 users):**
- Revenue: ~$80,000/month (variable)
- Costs: ~$35,000/month
- Margin: ~55-60%

---

### Model 4: Tiered with Usage Overage

```
Tier        | Price    | Clients | Letters | Mail Credits
------------|----------|---------|---------|-------------
Starter     | $49/mo   | 25      | 75      | $50
Professional| $99/mo   | 100     | 300     | $150
Business    | $199/mo  | 500     | 1,500   | $500
Enterprise  | $499/mo  | Unlimited| Unlimited| $1,500

Overages:
- Extra client: $3/month
- Extra letter: $0.20/letter
- Extra mail: At-cost + 25%
```

**Pros:** Clear tiers, upsell path, predictable base revenue
**Cons:** Complexity, potential for surprise bills

---

## Revenue Projections

### Conservative Scenario (Year 1)

| Quarter | Users | ARPU | MRR | ARR |
|---------|-------|------|-----|-----|
| Q1 | 50 | $75 | $3,750 | $45,000 |
| Q2 | 150 | $85 | $12,750 | $153,000 |
| Q3 | 400 | $95 | $38,000 | $456,000 |
| Q4 | 800 | $100 | $80,000 | $960,000 |

### Growth Scenario (Year 1-3)

| Year | Users | ARPU | MRR | ARR | Gross Margin |
|------|-------|------|-----|-----|--------------|
| Y1 | 800 | $100 | $80K | $960K | 55% |
| Y2 | 3,000 | $110 | $330K | $3.96M | 60% |
| Y3 | 8,000 | $120 | $960K | $11.5M | 65% |

---

## Recommendations

### Immediate Actions

1. **Implement mail passthrough billing**
   - Pass mail costs at cost + 20% markup
   - This is standard and expected in credit repair software
   - Covers largest variable cost

2. **Add AI usage tracking**
   - Track letters generated per organization
   - Enable future per-letter or per-dispute pricing
   - Provides data for pricing optimization

3. **Tier structure implementation**
   - Start with 3 tiers (Starter/Professional/Business)
   - Add Enterprise tier for volume customers
   - Include clear overage pricing

### Pricing Strategy (Recommended)

**Launch Pricing:**
```
STARTER ($49/month)
- 25 active clients
- 75 AI letters/month
- Mail: At-cost + 20%

PROFESSIONAL ($99/month) - Most Popular
- 100 active clients
- 300 AI letters/month
- Mail: At-cost + 15%
- Litigation tools

BUSINESS ($199/month)
- 500 active clients
- 1,500 AI letters/month
- Mail: At-cost + 10%
- Priority support

ENTERPRISE (Custom)
- Unlimited everything
- Volume discounts
- Dedicated success manager
```

**Overage Pricing:**
- Extra client: $3/month
- Extra letter: $0.20/letter
- Mail over credits: At-cost + 25%

### Long-Term Considerations

1. **Volume Discounts:** Offer 10-20% discount for annual prepay
2. **Partner Pricing:** Consider credit monitoring bundle (IdentityIQ revenue share)
3. **White-Label:** Premium tier for agencies wanting their own branding
4. **API Access:** Charge for direct API access ($0.50-1.00/call)

---

## Risk Mitigation

### Cost Overrun Protection

1. **Rate Limiting:** Implement letter generation limits
2. **Caching:** Cache legal frameworks, reduce token usage
3. **Model Fallback:** Use cheaper models for retries
4. **Batch Processing:** Combine similar operations

### Pricing Flexibility

1. **Grandfather Existing:** Lock in early adopters at launch prices
2. **Annual Commitments:** Discount for annual prepay (reduces churn risk)
3. **Usage Alerts:** Warn customers approaching limits before overage

---

## Appendix: Cost Calculator

Run the cost calculator:
```bash
npx ts-node docs/business/cost-calculator.ts
```

This will generate a detailed report with exact costs at each scale tier.

---

*Last Updated: February 2025*
*Version: 1.0*
