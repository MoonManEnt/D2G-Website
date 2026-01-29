# Dispute2Go Integration Plan

## Overview

Three major integrations to implement for competitive advantage:

| Integration | Purpose | Priority |
|-------------|---------|----------|
| **DocuPost** | Automatic letter mailing from app | HIGH |
| **IDIQ Affiliate** | Required signup for all users | HIGH |
| **IDIQ Credit Report API** | Auto-populate client/account data | HIGH |

---

## 1. DocuPost Integration - Automatic Letter Mailing

### API Details

**Endpoint:** `POST https://app.docupost.com/api/1.1/wf/sendletter`

**Authentication:** API token passed as query parameter `api_token`

### Required Parameters

| Parameter | Description | Constraint |
|-----------|-------------|------------|
| `api_token` | Your DocuPost API token | Keep secret |
| `to_name` | Recipient (CRA) name | Max 40 chars |
| `to_address1` | CRA street address | Required |
| `to_city` | CRA city | Required |
| `to_state` | State abbreviation | 2-letter code |
| `to_zip` | ZIP code | 5 digits |
| `from_name` | Client name | Max 40 chars |
| `from_address1` | Client address | Required |
| `from_city` | Client city | Required |
| `from_state` | Client state | 2-letter code |
| `from_zip` | Client ZIP | Required |
| `pdf` | URL to dispute letter PDF | Max 10MB |

### Optional Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `color` | Color printing | false |
| `doublesided` | Double-sided printing | true |
| `class` | Mail class | usps_first_class |
| `servicelevel` | "certified" or "certified_return_receipt" | standard |
| `return_envelope` | Include return envelope | false |
| `description` | Internal note | - |

### Implementation Tasks

#### Phase 1: Infrastructure

- [ ] Add DocuPost API credentials to environment variables
  ```env
  DOCUPOST_API_TOKEN=your_token_here
  DOCUPOST_API_URL=https://app.docupost.com/api/1.1/wf/sendletter
  ```

- [ ] Create `src/lib/docupost-service.ts`
  ```typescript
  interface MailLetterParams {
    recipientName: string;      // CRA name
    recipientAddress: string;
    recipientCity: string;
    recipientState: string;
    recipientZip: string;
    senderName: string;         // Client name
    senderAddress: string;
    senderCity: string;
    senderState: string;
    senderZip: string;
    pdfUrl: string;             // Generated letter PDF URL
    certified?: boolean;
    returnReceipt?: boolean;
    color?: boolean;
  }

  export async function sendLetterViaDocuPost(params: MailLetterParams): Promise<DocuPostResponse>
  export async function getMailingStatus(mailingId: string): Promise<MailingStatus>
  export async function cancelMailing(mailingId: string): Promise<boolean>
  ```

- [ ] Add CRA mailing addresses to constants
  ```typescript
  // src/lib/constants/cra-addresses.ts
  export const CRA_ADDRESSES = {
    EXPERIAN: {
      name: "Experian",
      address1: "P.O. Box 4500",
      city: "Allen",
      state: "TX",
      zip: "75013"
    },
    EQUIFAX: {
      name: "Equifax Information Services LLC",
      address1: "P.O. Box 740256",
      city: "Atlanta",
      state: "GA",
      zip: "30374"
    },
    TRANSUNION: {
      name: "TransUnion LLC Consumer Dispute Center",
      address1: "P.O. Box 2000",
      city: "Chester",
      state: "PA",
      zip: "19016"
    }
  };
  ```

#### Phase 2: Database Schema

- [ ] Add mailing tracking to Prisma schema
  ```prisma
  model MailingRecord {
    id              String    @id @default(uuid())
    disputeId       String?
    sentryDisputeId String?
    docupostId      String?   // DocuPost tracking ID
    status          String    // QUEUED, SENT, DELIVERED, RETURNED, CANCELED
    mailedAt        DateTime?
    deliveredAt     DateTime?
    trackingNumber  String?
    cost            Decimal?
    certified       Boolean   @default(false)
    returnReceipt   Boolean   @default(false)
    errorMessage    String?
    createdAt       DateTime  @default(now())
    updatedAt       DateTime  @updatedAt

    dispute         Dispute?       @relation(fields: [disputeId], references: [id])
    sentryDispute   SentryDispute? @relation(fields: [sentryDisputeId], references: [id])
    organizationId  String
    organization    Organization   @relation(fields: [organizationId], references: [id])

    @@index([disputeId])
    @@index([sentryDisputeId])
    @@index([status])
  }
  ```

#### Phase 3: API Endpoints

- [ ] Create `POST /api/disputes/[id]/mail` endpoint
  ```typescript
  // Request body
  {
    certified: boolean;
    returnReceipt: boolean;
    color?: boolean;
  }

  // Response
  {
    success: true,
    mailing: {
      id: string,
      docupostId: string,
      status: "QUEUED",
      estimatedDelivery: string,
      cost: number
    }
  }
  ```

- [ ] Create `POST /api/sentry/[id]/mail` endpoint (same structure)

- [ ] Create `GET /api/mailings/[id]/status` for tracking

#### Phase 4: UI Integration

- [ ] Add "Send via Mail" button to dispute launch flow
- [ ] Add mailing options modal (certified, return receipt, color)
- [ ] Add mailing status indicator on dispute cards
- [ ] Add mailing history tab on dispute detail page
- [ ] Show estimated cost before sending

#### Phase 5: Workflow Integration

- [ ] Modify launch flow to optionally trigger mailing
- [ ] Auto-generate PDF before mailing
- [ ] Store PDF in cloud storage (get URL for DocuPost)
- [ ] Update dispute `sentMethod` field when mailed
- [ ] Add tracking number to dispute record

### Pricing Considerations

DocuPost uses pay-as-you-go pricing. Need to:
- [ ] Display estimated cost to user before mailing
- [ ] Track mailing costs per organization
- [ ] Consider adding billing/credits system for mailing costs
- [ ] Or pass through to organization's DocuPost account

---

## 2. IDIQ/MyScoreIQ Affiliate Integration

### Affiliate Link

**URL:** `https://www.myscoreiq.com/get-fico-max.aspx?offercode=432142HO`

**Product:** FICO Max - $36.86/month

**Features included:**
- 3-Bureau Credit Reports & FICO Scores
- Daily Monitoring & Alerts
- Dark Web & Internet Monitoring
- $1M Stolen Funds Reimbursement
- Identity Restoration Services

### Implementation Tasks

#### Phase 1: Onboarding Flow

- [ ] Create IDIQ signup requirement in client onboarding
  ```typescript
  // Client model addition
  model Client {
    // ... existing fields
    idiqMemberId      String?   // Their IDIQ member ID
    idiqSignupDate    DateTime?
    idiqVerified      Boolean   @default(false)
  }
  ```

- [ ] Add IDIQ signup step to new client wizard
  - Step 1: Client info (existing)
  - Step 2: **IDIQ Signup Required** (NEW)
  - Step 3: Upload credit report

- [ ] Create IDIQ signup component
  ```tsx
  // src/components/IdiqSignupPrompt.tsx
  - Explains why IDIQ is required
  - Shows benefits ($36.86/mo value)
  - Opens affiliate link in new tab
  - Has "I've signed up" confirmation button
  - Stores member ID for verification
  ```

#### Phase 2: Website Integration (tryd2g.com)

- [ ] Add prominent IDIQ signup CTA on homepage
- [ ] Create dedicated "/credit-monitoring" page
- [ ] Add IDIQ benefits section
- [ ] Track affiliate conversions (if IDIQ provides tracking pixel)

#### Phase 3: Enforcement

- [ ] Block dispute creation without IDIQ signup
- [ ] Add reminder notifications for clients without IDIQ
- [ ] Show IDIQ status on client dashboard
- [ ] Add bulk IDIQ signup reminder emails

---

## 3. IDIQ Credit Report API - Auto-Import

### Status: PENDING DOCUMENTATION

**Note:** The IDIQ API documentation was in Gmail attachments that couldn't be accessed. Need Reginald to provide:

1. API endpoint URLs
2. Authentication method (API key, OAuth, etc.)
3. Request/response formats
4. Available data fields
5. Rate limits
6. Sandbox/test environment details

### Anticipated Implementation

Based on typical credit report APIs:

#### Phase 1: Service Layer

- [ ] Create `src/lib/idiq-service.ts`
  ```typescript
  interface IdiqCredentials {
    apiKey: string;
    partnerId: string;
  }

  interface CreditReportData {
    consumer: {
      firstName: string;
      lastName: string;
      ssn: string;
      dob: string;
      addresses: Address[];
    };
    accounts: {
      creditorName: string;
      accountNumber: string;
      accountType: string;
      balance: number;
      paymentStatus: string;
      dateOpened: Date;
      dateReported: Date;
      // ... more fields
    }[];
    inquiries: Inquiry[];
    publicRecords: PublicRecord[];
    scores: {
      experian: number;
      equifax: number;
      transunion: number;
    };
  }

  export async function fetchCreditReport(memberId: string): Promise<CreditReportData>
  export async function mapToClientFields(data: CreditReportData): Promise<Partial<Client>>
  export async function mapToAccountItems(data: CreditReportData): Promise<AccountItem[]>
  ```

#### Phase 2: Import Flow

- [ ] Add "Import from IDIQ" button on client page
- [ ] Create import wizard:
  1. Enter IDIQ member ID
  2. Authorize data pull
  3. Preview imported data
  4. Confirm and save
- [ ] Map IDIQ fields to D2G schema
- [ ] Detect and flag negative accounts automatically
- [ ] Run issue detection on imported accounts

#### Phase 3: Automation

- [ ] Webhook for automatic report updates (if IDIQ supports)
- [ ] Scheduled sync for active clients
- [ ] Delta detection (what changed since last import)
- [ ] Alert on new negative items

### Field Mapping (Anticipated)

| IDIQ Field | D2G Field | Table |
|------------|-----------|-------|
| consumer.firstName | firstName | Client |
| consumer.lastName | lastName | Client |
| consumer.ssn | ssnLast4 (last 4 only) | Client |
| consumer.dob | dateOfBirth | Client |
| consumer.addresses[0] | addressLine1, city, state, zipCode | Client |
| accounts[].creditorName | creditorName | AccountItem |
| accounts[].accountNumber | maskedAccountId (masked) | AccountItem |
| accounts[].balance | balance | AccountItem |
| accounts[].accountType | accountType | AccountItem |
| accounts[].paymentStatus | paymentStatus | AccountItem |
| accounts[].dateOpened | dateOpened | AccountItem |
| accounts[].dateReported | dateReported | AccountItem |
| scores.experian | experianScore | CreditReport |
| scores.equifax | equifaxScore | CreditReport |
| scores.transunion | transunionScore | CreditReport |

---

## File Changes Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `src/lib/docupost-service.ts` | DocuPost API integration |
| `src/lib/idiq-service.ts` | IDIQ credit report API |
| `src/lib/constants/cra-addresses.ts` | CRA mailing addresses |
| `src/components/IdiqSignupPrompt.tsx` | IDIQ signup flow |
| `src/components/MailingOptionsModal.tsx` | Mailing configuration UI |
| `src/app/api/disputes/[id]/mail/route.ts` | Mail dispute endpoint |
| `src/app/api/sentry/[id]/mail/route.ts` | Mail Sentry dispute endpoint |
| `src/app/api/mailings/[id]/status/route.ts` | Mailing status endpoint |
| `src/app/api/idiq/import/route.ts` | IDIQ import endpoint |

### Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add MailingRecord, IDIQ fields to Client |
| `src/app/(dashboard)/clients/new/page.tsx` | Add IDIQ signup step |
| `src/app/(dashboard)/disputes/[id]/page.tsx` | Add mail button |
| `src/app/(dashboard)/sentry/[clientId]/page.tsx` | Add mail button |

### Environment Variables to Add

```env
# DocuPost
DOCUPOST_API_TOKEN=
DOCUPOST_API_URL=https://app.docupost.com/api/1.1/wf/sendletter

# IDIQ (pending documentation)
IDIQ_API_KEY=
IDIQ_PARTNER_ID=
IDIQ_API_URL=

# Affiliate
IDIQ_AFFILIATE_URL=https://www.myscoreiq.com/get-fico-max.aspx?offercode=432142HO
```

---

## Priority Order

1. **IDIQ Affiliate Integration** - Quick win, generates revenue immediately
2. **DocuPost Integration** - Major competitive advantage
3. **IDIQ Credit Report API** - Depends on getting API docs

---

## Questions for Tomorrow

1. Can you export/share the IDIQ API documentation from those Gmail attachments?
2. Do you have a DocuPost account? Need API token from their Developer page.
3. For the affiliate link - do you get tracking/conversion data from IDIQ?
4. Should mailing costs be passed through to organizations or handled centrally?
5. What's the tryd2g.com tech stack? (Need to know for integration)

---

## Competitive Advantage Summary

| Feature | CRC | Dispute Fox | D2G (After Integration) |
|---------|-----|-------------|-------------------------|
| Auto-mail letters | Manual | Manual? | **Automatic via DocuPost** |
| Credit report import | Manual upload | Manual upload | **Auto-import via IDIQ API** |
| Dispute codes | None | Unknown | **D2GO-YYYYMMDD-XXX** |
| Account locking | None | Unknown | **Cross-system validation** |
| Identity protection | Separate | Separate | **Built-in IDIQ requirement** |

This positions D2G as the most automated, integrated solution in the market.
