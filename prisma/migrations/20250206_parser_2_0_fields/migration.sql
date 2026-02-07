-- Parser 2.0 Schema Additions
-- Enhanced extraction fields, self-validation, and duplicate handling

-- =====================================================================
-- AccountItem - New Parser 2.0 Fields
-- =====================================================================

-- Payment history grid (84 months per bureau, JSON format)
ALTER TABLE "AccountItem" ADD COLUMN IF NOT EXISTS "paymentHistory" TEXT;

-- Account responsibility (for AU detection)
ALTER TABLE "AccountItem" ADD COLUMN IF NOT EXISTS "responsibility" TEXT;
ALTER TABLE "AccountItem" ADD COLUMN IF NOT EXISTS "isAuthorizedUser" BOOLEAN NOT NULL DEFAULT false;

-- Dispute notation tracking
ALTER TABLE "AccountItem" ADD COLUMN IF NOT EXISTS "disputeNotations" TEXT;
ALTER TABLE "AccountItem" ADD COLUMN IF NOT EXISTS "hasBeenPreviouslyDisputed" BOOLEAN NOT NULL DEFAULT false;

-- Critical dates for SOL and analysis
ALTER TABLE "AccountItem" ADD COLUMN IF NOT EXISTS "dateOfFirstDelinquency" TIMESTAMP(3);
ALTER TABLE "AccountItem" ADD COLUMN IF NOT EXISTS "dateOfLastPayment" TIMESTAMP(3);
ALTER TABLE "AccountItem" ADD COLUMN IF NOT EXISTS "numberOfMonths" INTEGER;

-- Enhanced account classification
ALTER TABLE "AccountItem" ADD COLUMN IF NOT EXISTS "accountTypeDetail" TEXT;
ALTER TABLE "AccountItem" ADD COLUMN IF NOT EXISTS "bureauCode" TEXT;

-- Full comments from report
ALTER TABLE "AccountItem" ADD COLUMN IF NOT EXISTS "reportComments" TEXT;

-- Sequence index for duplicate handling (8 Nelnet accounts scenario)
ALTER TABLE "AccountItem" ADD COLUMN IF NOT EXISTS "sequenceIndex" INTEGER NOT NULL DEFAULT 0;

-- =====================================================================
-- CreditReport - New Parser 2.0 Fields
-- =====================================================================

-- Account summary for self-validation
ALTER TABLE "CreditReport" ADD COLUMN IF NOT EXISTS "accountSummary" TEXT;

-- Personal info comparison across bureaus
ALTER TABLE "CreditReport" ADD COLUMN IF NOT EXISTS "personalInfoByBureau" TEXT;

-- Credit scores extracted from report
ALTER TABLE "CreditReport" ADD COLUMN IF NOT EXISTS "creditScoresExtracted" TEXT;

-- Parser metadata
ALTER TABLE "CreditReport" ADD COLUMN IF NOT EXISTS "parserVersion" TEXT;
ALTER TABLE "CreditReport" ADD COLUMN IF NOT EXISTS "reportFormatVersion" TEXT;

-- Extraction method metadata
ALTER TABLE "CreditReport" ADD COLUMN IF NOT EXISTS "extractionMethod" TEXT;
ALTER TABLE "CreditReport" ADD COLUMN IF NOT EXISTS "extractionConfidence" DOUBLE PRECISION;
ALTER TABLE "CreditReport" ADD COLUMN IF NOT EXISTS "ocrConfidence" DOUBLE PRECISION;

-- =====================================================================
-- Update Unique Constraint for AccountItem
-- =====================================================================

-- Drop the old unique constraint
ALTER TABLE "AccountItem" DROP CONSTRAINT IF EXISTS "AccountItem_reportId_fingerprint_cra_key";

-- Create the new unique constraint with sequenceIndex
ALTER TABLE "AccountItem" ADD CONSTRAINT "AccountItem_reportId_fingerprint_cra_sequenceIndex_key"
UNIQUE ("reportId", "fingerprint", "cra", "sequenceIndex");

-- =====================================================================
-- Add Indexes for New Fields
-- =====================================================================

CREATE INDEX IF NOT EXISTS "AccountItem_isAuthorizedUser_idx" ON "AccountItem"("isAuthorizedUser");
CREATE INDEX IF NOT EXISTS "AccountItem_hasBeenPreviouslyDisputed_idx" ON "AccountItem"("hasBeenPreviouslyDisputed");
CREATE INDEX IF NOT EXISTS "CreditReport_parserVersion_idx" ON "CreditReport"("parserVersion");
