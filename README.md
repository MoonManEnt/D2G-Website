# Dispute2Go

**Credit Dispute Operating System for Specialists**

Transform IdentityIQ credit reports into structured, compliant dispute workflows with automated statute sequencing, document generation, and month-over-month tracking.

![Dispute2Go Dashboard](docs/dashboard-preview.png)

## Features

### Core Capabilities
- 📄 **PDF Parsing** - Extract account data from IdentityIQ credit reports
- 🔄 **Diff Engine** - Track month-over-month changes across reports
- 📝 **Document Generation** - Create CRA letters with statute citations
- 📋 **CFPB Drafts** - Generate CFPB complaint narratives (statute-free)
- ✂️ **Evidence Tools** - Crop and annotate report sections
- 📊 **Confidence Scoring** - Flag low-confidence parses for review

### Dispute Doctrine
- **Accuracy Flow** - 12 rounds of FCRA-based escalation
- **Collection Flow** - 10 rounds of FDCPA-based dispute
- **Consent Flow** - 4 rounds for permissible purpose issues
- **Combo Flow** - Combined approach for complex cases

### Business Features
- 👥 Multi-client management
- 🏢 Organization isolation
- 💳 Subscription gating (Free/Pro tiers)
- 📈 Activity tracking and audit logs

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js (Credentials)
- **Styling**: Tailwind CSS + shadcn/ui
- **Payments**: Stripe
- **PDF**: pdfjs-dist
- **Canvas**: Konva.js (evidence tools)

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/dispute2go.git
   cd dispute2go
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your values:
   ```env
   DATABASE_URL="postgresql://user:pass@localhost:5432/dispute2go"
   NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
   NEXTAUTH_URL="http://localhost:3000"
   ```

4. **Setup database**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   
   # Seed with demo data
   npm run db:seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open the app**
   
   Visit [http://localhost:3000](http://localhost:3000)
   
   **Demo credentials:**
   - Email: `admin@dispute2go.demo`
   - Password: `Demo1234!`

## Project Structure

```
dispute2go/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Demo data seeder
├── src/
│   ├── app/
│   │   ├── (auth)/        # Login pages
│   │   ├── (dashboard)/   # Main app pages
│   │   └── api/           # API routes
│   ├── components/
│   │   ├── ui/            # shadcn/ui components
│   │   └── layout/        # Layout components
│   ├── lib/
│   │   ├── auth.ts        # NextAuth config
│   │   ├── prisma.ts      # Database client
│   │   ├── parser.ts      # PDF parsing engine
│   │   ├── diff-engine.ts # Report comparison
│   │   ├── document-generator.ts
│   │   ├── subscription.ts
│   │   ├── validation.ts
│   │   └── utils.ts
│   └── types/
│       └── index.ts       # TypeScript definitions
└── public/
```

## Key Workflows

### 1. Upload & Parse Report
```
Upload PDF → Validate → Extract Text → Parse Accounts → Score Confidence → Save
```

### 2. Review & Confirm
```
View Ledger → Filter Needs Review → Confirm/Override → Assign Flow
```

### 3. Generate Documents
```
Select Accounts → Choose Round → Generate Letter → Add Evidence → Approve
```

### 4. Track & Advance
```
Print Letter → Mark Sent → Log Response → Advance Round → Repeat
```

## API Reference

### Clients
- `GET /api/clients` - List clients
- `POST /api/clients` - Create client
- `GET /api/clients/[id]` - Get client
- `PUT /api/clients/[id]` - Update client
- `DELETE /api/clients/[id]` - Delete client

### Reports
- `GET /api/reports` - List reports
- `POST /api/reports` - Upload & parse report
- `GET /api/reports/[id]` - Get report with accounts

### Disputes
- `GET /api/disputes` - List disputes
- `POST /api/disputes` - Create dispute
- `PUT /api/disputes/[id]` - Update status

### Documents
- `POST /api/documents/generate` - Generate letter/draft

## Configuration

### Subscription Tiers

| Feature | Free | Pro |
|---------|------|-----|
| Clients | 1 | Unlimited |
| Report Upload | ❌ | ✅ |
| Letter Generation | ❌ | ✅ |
| CFPB Drafts | ❌ | ✅ |
| Evidence Tools | ❌ | ✅ |
| Diff Engine | ❌ | ✅ |

### Flow & Round Doctrine

The system enforces statute sequencing per flow. Each round cites specific FCRA/FDCPA statutes with escalating severity.

**Accuracy Flow (12 rounds)** - FCRA-based escalation for inaccurate reporting
1. Factual Dispute (no statute)
2. 1681e(b) - Maximum Accuracy
3. 1681i(a)(5) - Reinvestigation Results
4. 1681i(a)(1)(A) - Reinvestigation Requirement
5. 1681i(a)(7) - Description of Process
6. 1681i(a)(6)(B)(iii) - Method of Verification
7. 1681i(c) - Information Provider Notice
8. 1681s-2(b) - Furnisher Duties
9. 1681(b) - Permissible Purposes
10. 1681c(e) - Information Update
11. 1681e(b) - Discharged Debt Accuracy
12. Litigation Marker

**Collection Flow (10 rounds)** - FDCPA-based dispute for debt collection accounts
1. 1692g - Validation Notice
2. 1692g(b) - Validation Request
3. 1692j - Unfair Practices
4. 1681a(m) - Medical Information
5. 1681(b) - Permissible Purposes
6. 1692e(10) - False Representation
7. 1681q - False Information
8. 1692c(c) - Cease Communication
9. 1681b(a)(3)(A) - Collection Purpose
10. Litigation Marker

**Consent Flow (4 rounds)** - Privacy/permissible purpose violations
1. 1681b(a)(2) - Written Consent
2. 1681(a)(4) - Consumer Privacy
3. 1681a(d)(2)(B) - Consumer Report Definition
4. Flow Switch (returns to Accuracy or Collection)

**Combo Flow** - Uses both Accuracy and Collection statutes for complex cases with mixed account types

### Letter Structure

Every generated letter follows the AMELIA doctrine structure:
- **Header** - Client info, date, CRA address
- **Headline** - Attention-grabbing statement
- **Opening** - Context and intent
- **Body** - Statute citations, facts, demands
- **Account List** - Specific disputed items
- **Demand** - Legal requirements
- **Corrections** - Requested changes
- **Consumer Statement** - Emotional closing (included in ALL rounds, ALL flows)
- **Closing** - Signature block

## Development

### Running Tests
```bash
npm run test
```

### Database Commands
```bash
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes
npm run db:seed      # Seed demo data
npm run db:studio    # Open Prisma Studio
```

### Build for Production
```bash
npm run build
npm run start
```

## Deployment

### Vercel (Recommended)
1. Connect GitHub repository
2. Set environment variables
3. Deploy

### Docker
```bash
docker build -t dispute2go .
docker run -p 3000:3000 dispute2go
```

## License

Proprietary - All rights reserved.

## Support

For support, email support@dispute2go.com or open an issue.
