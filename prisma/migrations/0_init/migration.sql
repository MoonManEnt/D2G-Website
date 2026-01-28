-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'FREE',
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#7c3aed',
    "secondaryColor" TEXT,
    "supportEmail" TEXT,
    "websiteUrl" TEXT,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SPECIALIST',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "profilePicture" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "ssnLast4" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "creditMonitoringId" TEXT,
    "creditMonitoringStatus" TEXT,
    "creditMonitoringProvider" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'STANDARD',
    "segment" TEXT NOT NULL DEFAULT 'NEW',
    "stage" TEXT NOT NULL DEFAULT 'INTAKE',
    "stageChangedAt" TIMESTAMP(3),
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION,
    "lastActivityAt" TIMESTAMP(3),
    "activeBureaus" TEXT NOT NULL DEFAULT '[]',
    "totalDisputesSent" INTEGER NOT NULL DEFAULT 0,
    "totalItemsDeleted" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "archiveReason" TEXT,
    "lastDisputeSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditReport" (
    "id" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" TEXT NOT NULL DEFAULT 'IDENTITYIQ',
    "originalFileId" TEXT NOT NULL,
    "parseStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "parseError" TEXT,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "renderedPageIds" TEXT NOT NULL DEFAULT '[]',
    "previousNames" TEXT NOT NULL DEFAULT '[]',
    "previousAddresses" TEXT NOT NULL DEFAULT '[]',
    "hardInquiries" TEXT NOT NULL DEFAULT '[]',
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountItem" (
    "id" TEXT NOT NULL,
    "creditorName" TEXT NOT NULL,
    "maskedAccountId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "cra" TEXT NOT NULL,
    "accountType" TEXT,
    "accountStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "balance" DOUBLE PRECISION,
    "pastDue" DOUBLE PRECISION,
    "creditLimit" DOUBLE PRECISION,
    "highBalance" DOUBLE PRECISION,
    "monthlyPayment" DOUBLE PRECISION,
    "dateOpened" TIMESTAMP(3),
    "dateReported" TIMESTAMP(3),
    "lastActivityDate" TIMESTAMP(3),
    "disputeComment" TEXT,
    "paymentStatus" TEXT,
    "confidenceScore" INTEGER NOT NULL DEFAULT 0,
    "confidenceLevel" TEXT NOT NULL DEFAULT 'LOW',
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "assignedFlow" TEXT,
    "suggestedFlow" TEXT,
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "flowLockedAt" TIMESTAMP(3),
    "rawExtractedData" TEXT,
    "detectedIssues" TEXT,
    "isDisputable" BOOLEAN NOT NULL DEFAULT false,
    "issueCount" INTEGER NOT NULL DEFAULT 0,
    "sourcePageNum" INTEGER,
    "sourcePageEnd" INTEGER,
    "reportId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiffResult" (
    "id" TEXT NOT NULL,
    "priorReportId" TEXT NOT NULL,
    "newReportId" TEXT NOT NULL,
    "accountsAdded" INTEGER NOT NULL DEFAULT 0,
    "accountsRemoved" INTEGER NOT NULL DEFAULT 0,
    "accountsChanged" INTEGER NOT NULL DEFAULT 0,
    "accountsUnchanged" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiffResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiffChange" (
    "id" TEXT NOT NULL,
    "diffResultId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "oldAccountId" TEXT,
    "newAccountId" TEXT,
    "changedFields" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiffChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "cra" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "letterContent" TEXT,
    "referenceNumber" TEXT,
    "aiStrategy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "sentDate" TIMESTAMP(3),
    "mailedLetterId" TEXT,
    "mailedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "responseNotes" TEXT,
    "responseOutcome" TEXT,
    "deadlineDate" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeItem" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "accountItemId" TEXT NOT NULL,
    "disputeReason" TEXT,
    "suggestedFlow" TEXT,
    "priorityScore" INTEGER,
    "outcome" TEXT,
    "outcomeNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeResponse" (
    "id" TEXT NOT NULL,
    "disputeItemId" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "responseDate" TIMESTAMP(3) NOT NULL,
    "responseMethod" TEXT NOT NULL DEFAULT 'MAIL',
    "stallTactic" TEXT,
    "stallDetails" TEXT,
    "updateType" TEXT,
    "previousValue" TEXT,
    "newValue" TEXT,
    "verificationMethod" TEXT,
    "furnisherResponse" TEXT,
    "responseLetterFileId" TEXT,
    "notes" TEXT,
    "daysToRespond" INTEGER NOT NULL DEFAULT 0,
    "fcraDeadlineDate" TIMESTAMP(3),
    "wasLate" BOOLEAN NOT NULL DEFAULT false,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisputeResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeRoundHistory" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "flow" TEXT NOT NULL,
    "cra" TEXT NOT NULL,
    "letterSentDate" TIMESTAMP(3),
    "letterContent" TEXT,
    "letterHash" TEXT,
    "responseReceivedDate" TIMESTAMP(3),
    "overallOutcome" TEXT,
    "itemOutcomes" TEXT NOT NULL DEFAULT '{}',
    "nextRoundContext" TEXT NOT NULL DEFAULT '{}',
    "itemsDisputed" INTEGER NOT NULL DEFAULT 0,
    "itemsDeleted" INTEGER NOT NULL DEFAULT 0,
    "itemsVerified" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "itemsNoResponse" INTEGER NOT NULL DEFAULT 0,
    "itemsStalled" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisputeRoundHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "statutesCited" TEXT NOT NULL DEFAULT '[]',
    "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvalNotes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentDocumentId" TEXT,
    "generatedFileId" TEXT,
    "disputeId" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiMetadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentEvidence" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "sourcePageNum" INTEGER,
    "cropRegion" TEXT,
    "annotations" TEXT,
    "sourceFileId" TEXT,
    "renderedFileId" TEXT,
    "accountItemId" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingEvidence" (
    "id" TEXT NOT NULL,
    "accountItemId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "suggestedPages" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "storageType" TEXT NOT NULL DEFAULT 'LOCAL',
    "checksum" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatuteContent" (
    "id" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "statuteCode" TEXT NOT NULL,
    "shortTitle" TEXT NOT NULL,
    "fullText" TEXT NOT NULL,
    "argumentText" TEXT NOT NULL,
    "organizationId" TEXT,
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatuteContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LetterTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "flow" TEXT,
    "round" INTEGER,
    "cra" TEXT,
    "headerTemplate" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "footerTemplate" TEXT NOT NULL,
    "organizationId" TEXT,
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LetterTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "eventData" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetaFeedback" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rating" INTEGER,
    "comment" TEXT NOT NULL,
    "page" TEXT,
    "userAgent" TEXT,
    "screenSize" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "organizationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BetaFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "linkUrl" TEXT,
    "linkText" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LLMRequest" (
    "id" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "userAccepted" BOOLEAN,
    "userEdited" BOOLEAN,
    "editDistance" INTEGER,
    "isABTest" BOOLEAN NOT NULL DEFAULT false,
    "abTestGroup" TEXT,
    "alternateOutput" TEXT,
    "disputeId" TEXT,
    "disputeOutcome" TEXT,
    "flow" TEXT,
    "round" INTEGER,
    "cra" TEXT,
    "wasError" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "wasRetry" BOOLEAN NOT NULL DEFAULT false,
    "retryOf" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LLMRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LLMProviderStats" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "avgLatencyMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgCostCents" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "acceptanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LLMProviderStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditScore" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "cra" TEXT NOT NULL,
    "scoreType" TEXT NOT NULL DEFAULT 'VANTAGE3',
    "score" INTEGER NOT NULL,
    "scoreDate" TIMESTAMP(3) NOT NULL,
    "reportId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "factorsPositive" TEXT,
    "factorsNegative" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPortalAccess" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPortalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "disputeId" TEXT,
    "reminderType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "repeatInterval" TEXT NOT NULL DEFAULT 'NONE',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientDocument" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "isClientVisible" BOOLEAN NOT NULL DEFAULT false,
    "isSecure" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmeliaContentHash" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sourceDocId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmeliaContentHash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalInfoDispute" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "cra" TEXT NOT NULL,
    "inquiryDate" TEXT,
    "firstDisputedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDisputedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disputeCount" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "removedAt" TIMESTAMP(3),
    "removedInReportId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalInfoDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Communication" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "contentHtml" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "externalId" TEXT,
    "provider" TEXT,
    "disputeId" TEXT,
    "documentId" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditDNA" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "subClassifications" TEXT NOT NULL DEFAULT '[]',
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "confidenceLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "healthScore" INTEGER NOT NULL DEFAULT 0,
    "improvementPotential" INTEGER NOT NULL DEFAULT 0,
    "urgencyScore" INTEGER NOT NULL DEFAULT 0,
    "fileThickness" TEXT NOT NULL DEFAULT '{}',
    "derogatoryProfile" TEXT NOT NULL DEFAULT '{}',
    "utilization" TEXT NOT NULL DEFAULT '{}',
    "bureauDivergence" TEXT NOT NULL DEFAULT '{}',
    "inquiryAnalysis" TEXT NOT NULL DEFAULT '{}',
    "positiveFactors" TEXT NOT NULL DEFAULT '{}',
    "disputeReadiness" TEXT NOT NULL DEFAULT '{}',
    "summary" TEXT NOT NULL DEFAULT '',
    "keyInsights" TEXT NOT NULL DEFAULT '[]',
    "immediateActions" TEXT NOT NULL DEFAULT '[]',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "computeTimeMs" INTEGER NOT NULL DEFAULT 0,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditDNA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientArchiveSnapshot" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "snapshotVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archiveReason" TEXT NOT NULL,
    "clientProfile" TEXT NOT NULL,
    "creditDNA" TEXT NOT NULL,
    "creditScores" TEXT NOT NULL,
    "disputes" TEXT NOT NULL,
    "disputeResponses" TEXT NOT NULL,
    "roundHistory" TEXT NOT NULL,
    "communications" TEXT NOT NULL,
    "accounts" TEXT NOT NULL,
    "evidenceRefs" TEXT NOT NULL,
    "documents" TEXT NOT NULL,
    "eventLogs" TEXT NOT NULL,
    "ameliaContext" TEXT NOT NULL,
    "snapshotSizeBytes" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientArchiveSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentryDispute" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cra" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "letterContent" TEXT,
    "letterContentHash" TEXT,
    "eoscarCodes" TEXT,
    "metro2Fields" TEXT,
    "citationValidation" TEXT,
    "ocrRiskScore" INTEGER,
    "successProbability" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentDate" TIMESTAMP(3),
    "deadlineDate" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SentryDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentryDisputeItem" (
    "id" TEXT NOT NULL,
    "sentryDisputeId" TEXT NOT NULL,
    "accountItemId" TEXT NOT NULL,
    "eoscarCode" TEXT,
    "metro2Fields" TEXT,
    "disputeReason" TEXT,
    "customLanguage" TEXT,
    "outcome" TEXT,
    "responseDate" TIMESTAMP(3),
    "responseNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SentryDisputeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentryAnalysis" (
    "id" TEXT NOT NULL,
    "sentryDisputeId" TEXT NOT NULL,
    "recommendedCodes" TEXT NOT NULL,
    "codeSelectionRationale" TEXT,
    "validCitations" TEXT,
    "invalidCitations" TEXT,
    "citationWarnings" TEXT,
    "ocrScore" INTEGER NOT NULL,
    "ocrFindings" TEXT,
    "ocrFixSuggestions" TEXT,
    "identifiedFields" TEXT,
    "fieldDiscrepancies" TEXT,
    "successProbability" DOUBLE PRECISION NOT NULL,
    "successBreakdown" TEXT NOT NULL,
    "improvementTips" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SentryAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FurnisherProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "totalDisputes" INTEGER NOT NULL DEFAULT 0,
    "verificationRate" DOUBLE PRECISION,
    "deletionRate" DOUBLE PRECISION,
    "avgResponseDays" DOUBLE PRECISION,
    "effectiveCodes" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FurnisherProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentryCodeOutcome" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "furnisherName" TEXT,
    "outcome" TEXT NOT NULL,
    "sentryDisputeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentryCodeOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_stripeCustomerId_idx" ON "Organization"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Client_organizationId_idx" ON "Client"("organizationId");

-- CreateIndex
CREATE INDEX "Client_lastName_firstName_idx" ON "Client"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Client_creditMonitoringId_idx" ON "Client"("creditMonitoringId");

-- CreateIndex
CREATE INDEX "Client_organizationId_priority_idx" ON "Client"("organizationId", "priority");

-- CreateIndex
CREATE INDEX "Client_organizationId_stage_idx" ON "Client"("organizationId", "stage");

-- CreateIndex
CREATE INDEX "Client_organizationId_lastActivityAt_idx" ON "Client"("organizationId", "lastActivityAt");

-- CreateIndex
CREATE INDEX "CreditReport_organizationId_idx" ON "CreditReport"("organizationId");

-- CreateIndex
CREATE INDEX "CreditReport_clientId_idx" ON "CreditReport"("clientId");

-- CreateIndex
CREATE INDEX "CreditReport_reportDate_idx" ON "CreditReport"("reportDate");

-- CreateIndex
CREATE INDEX "AccountItem_organizationId_idx" ON "AccountItem"("organizationId");

-- CreateIndex
CREATE INDEX "AccountItem_clientId_idx" ON "AccountItem"("clientId");

-- CreateIndex
CREATE INDEX "AccountItem_fingerprint_idx" ON "AccountItem"("fingerprint");

-- CreateIndex
CREATE INDEX "AccountItem_confidenceLevel_idx" ON "AccountItem"("confidenceLevel");

-- CreateIndex
CREATE INDEX "AccountItem_isConfirmed_idx" ON "AccountItem"("isConfirmed");

-- CreateIndex
CREATE UNIQUE INDEX "AccountItem_reportId_fingerprint_cra_key" ON "AccountItem"("reportId", "fingerprint", "cra");

-- CreateIndex
CREATE INDEX "DiffResult_newReportId_idx" ON "DiffResult"("newReportId");

-- CreateIndex
CREATE UNIQUE INDEX "DiffResult_priorReportId_newReportId_key" ON "DiffResult"("priorReportId", "newReportId");

-- CreateIndex
CREATE INDEX "DiffChange_diffResultId_idx" ON "DiffChange"("diffResultId");

-- CreateIndex
CREATE INDEX "Dispute_organizationId_idx" ON "Dispute"("organizationId");

-- CreateIndex
CREATE INDEX "Dispute_clientId_idx" ON "Dispute"("clientId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "Dispute_cra_round_idx" ON "Dispute"("cra", "round");

-- CreateIndex
CREATE INDEX "Dispute_mailedLetterId_idx" ON "Dispute"("mailedLetterId");

-- CreateIndex
CREATE INDEX "DisputeItem_disputeId_idx" ON "DisputeItem"("disputeId");

-- CreateIndex
CREATE UNIQUE INDEX "DisputeItem_disputeId_accountItemId_key" ON "DisputeItem"("disputeId", "accountItemId");

-- CreateIndex
CREATE INDEX "DisputeResponse_disputeItemId_idx" ON "DisputeResponse"("disputeItemId");

-- CreateIndex
CREATE INDEX "DisputeResponse_disputeId_idx" ON "DisputeResponse"("disputeId");

-- CreateIndex
CREATE INDEX "DisputeResponse_outcome_idx" ON "DisputeResponse"("outcome");

-- CreateIndex
CREATE INDEX "DisputeResponse_responseDate_idx" ON "DisputeResponse"("responseDate");

-- CreateIndex
CREATE INDEX "DisputeRoundHistory_disputeId_idx" ON "DisputeRoundHistory"("disputeId");

-- CreateIndex
CREATE INDEX "DisputeRoundHistory_clientId_idx" ON "DisputeRoundHistory"("clientId");

-- CreateIndex
CREATE INDEX "DisputeRoundHistory_organizationId_idx" ON "DisputeRoundHistory"("organizationId");

-- CreateIndex
CREATE INDEX "DisputeRoundHistory_round_cra_idx" ON "DisputeRoundHistory"("round", "cra");

-- CreateIndex
CREATE INDEX "Document_organizationId_idx" ON "Document"("organizationId");

-- CreateIndex
CREATE INDEX "Document_disputeId_idx" ON "Document"("disputeId");

-- CreateIndex
CREATE INDEX "Document_approvalStatus_idx" ON "Document"("approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentEvidence_documentId_evidenceId_key" ON "DocumentEvidence"("documentId", "evidenceId");

-- CreateIndex
CREATE INDEX "Evidence_organizationId_idx" ON "Evidence"("organizationId");

-- CreateIndex
CREATE INDEX "Evidence_accountItemId_idx" ON "Evidence"("accountItemId");

-- CreateIndex
CREATE INDEX "PendingEvidence_accountItemId_idx" ON "PendingEvidence"("accountItemId");

-- CreateIndex
CREATE INDEX "PendingEvidence_reportId_idx" ON "PendingEvidence"("reportId");

-- CreateIndex
CREATE INDEX "PendingEvidence_organizationId_idx" ON "PendingEvidence"("organizationId");

-- CreateIndex
CREATE INDEX "PendingEvidence_status_idx" ON "PendingEvidence"("status");

-- CreateIndex
CREATE INDEX "StoredFile_organizationId_idx" ON "StoredFile"("organizationId");

-- CreateIndex
CREATE INDEX "StoredFile_storagePath_idx" ON "StoredFile"("storagePath");

-- CreateIndex
CREATE INDEX "StatuteContent_flow_round_idx" ON "StatuteContent"("flow", "round");

-- CreateIndex
CREATE UNIQUE INDEX "StatuteContent_flow_round_organizationId_key" ON "StatuteContent"("flow", "round", "organizationId");

-- CreateIndex
CREATE INDEX "LetterTemplate_documentType_flow_round_idx" ON "LetterTemplate"("documentType", "flow", "round");

-- CreateIndex
CREATE INDEX "LetterTemplate_organizationId_idx" ON "LetterTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "EventLog_organizationId_idx" ON "EventLog"("organizationId");

-- CreateIndex
CREATE INDEX "EventLog_eventType_idx" ON "EventLog"("eventType");

-- CreateIndex
CREATE INDEX "EventLog_targetType_targetId_idx" ON "EventLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "EventLog_createdAt_idx" ON "EventLog"("createdAt");

-- CreateIndex
CREATE INDEX "EventLog_actorId_idx" ON "EventLog"("actorId");

-- CreateIndex
CREATE INDEX "BetaFeedback_type_idx" ON "BetaFeedback"("type");

-- CreateIndex
CREATE INDEX "BetaFeedback_status_idx" ON "BetaFeedback"("status");

-- CreateIndex
CREATE INDEX "BetaFeedback_createdAt_idx" ON "BetaFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "BetaFeedback_organizationId_idx" ON "BetaFeedback"("organizationId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "LLMRequest_organizationId_idx" ON "LLMRequest"("organizationId");

-- CreateIndex
CREATE INDEX "LLMRequest_taskType_idx" ON "LLMRequest"("taskType");

-- CreateIndex
CREATE INDEX "LLMRequest_provider_idx" ON "LLMRequest"("provider");

-- CreateIndex
CREATE INDEX "LLMRequest_createdAt_idx" ON "LLMRequest"("createdAt");

-- CreateIndex
CREATE INDEX "LLMRequest_disputeId_idx" ON "LLMRequest"("disputeId");

-- CreateIndex
CREATE INDEX "LLMProviderStats_provider_taskType_idx" ON "LLMProviderStats"("provider", "taskType");

-- CreateIndex
CREATE UNIQUE INDEX "LLMProviderStats_provider_taskType_periodStart_key" ON "LLMProviderStats"("provider", "taskType", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "CreditScore_clientId_scoreDate_idx" ON "CreditScore"("clientId", "scoreDate");

-- CreateIndex
CREATE INDEX "CreditScore_clientId_cra_idx" ON "CreditScore"("clientId", "cra");

-- CreateIndex
CREATE INDEX "CreditScore_scoreDate_idx" ON "CreditScore"("scoreDate");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalAccess_clientId_key" ON "ClientPortalAccess"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalAccess_email_key" ON "ClientPortalAccess"("email");

-- CreateIndex
CREATE INDEX "ClientPortalAccess_email_idx" ON "ClientPortalAccess"("email");

-- CreateIndex
CREATE INDEX "ClientPortalAccess_clientId_idx" ON "ClientPortalAccess"("clientId");

-- CreateIndex
CREATE INDEX "Reminder_clientId_scheduledFor_idx" ON "Reminder"("clientId", "scheduledFor");

-- CreateIndex
CREATE INDEX "Reminder_status_scheduledFor_idx" ON "Reminder"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Reminder_disputeId_idx" ON "Reminder"("disputeId");

-- CreateIndex
CREATE INDEX "ClientDocument_clientId_category_idx" ON "ClientDocument"("clientId", "category");

-- CreateIndex
CREATE INDEX "ClientDocument_organizationId_idx" ON "ClientDocument"("organizationId");

-- CreateIndex
CREATE INDEX "ClientDocument_fileId_idx" ON "ClientDocument"("fileId");

-- CreateIndex
CREATE INDEX "AmeliaContentHash_clientId_idx" ON "AmeliaContentHash"("clientId");

-- CreateIndex
CREATE INDEX "AmeliaContentHash_contentHash_idx" ON "AmeliaContentHash"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "AmeliaContentHash_clientId_contentHash_key" ON "AmeliaContentHash"("clientId", "contentHash");

-- CreateIndex
CREATE INDEX "PersonalInfoDispute_clientId_idx" ON "PersonalInfoDispute"("clientId");

-- CreateIndex
CREATE INDEX "PersonalInfoDispute_clientId_status_idx" ON "PersonalInfoDispute"("clientId", "status");

-- CreateIndex
CREATE INDEX "PersonalInfoDispute_organizationId_idx" ON "PersonalInfoDispute"("organizationId");

-- CreateIndex
CREATE INDEX "PersonalInfoDispute_status_idx" ON "PersonalInfoDispute"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalInfoDispute_clientId_type_value_cra_key" ON "PersonalInfoDispute"("clientId", "type", "value", "cra");

-- CreateIndex
CREATE INDEX "Communication_clientId_createdAt_idx" ON "Communication"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "Communication_organizationId_createdAt_idx" ON "Communication"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Communication_type_status_idx" ON "Communication"("type", "status");

-- CreateIndex
CREATE INDEX "Communication_externalId_idx" ON "Communication"("externalId");

-- CreateIndex
CREATE INDEX "CreditDNA_clientId_idx" ON "CreditDNA"("clientId");

-- CreateIndex
CREATE INDEX "CreditDNA_organizationId_idx" ON "CreditDNA"("organizationId");

-- CreateIndex
CREATE INDEX "CreditDNA_classification_idx" ON "CreditDNA"("classification");

-- CreateIndex
CREATE INDEX "CreditDNA_analyzedAt_idx" ON "CreditDNA"("analyzedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientArchiveSnapshot_clientId_key" ON "ClientArchiveSnapshot"("clientId");

-- CreateIndex
CREATE INDEX "ClientArchiveSnapshot_organizationId_idx" ON "ClientArchiveSnapshot"("organizationId");

-- CreateIndex
CREATE INDEX "ClientArchiveSnapshot_expiresAt_idx" ON "ClientArchiveSnapshot"("expiresAt");

-- CreateIndex
CREATE INDEX "ClientArchiveSnapshot_organizationId_expiresAt_idx" ON "ClientArchiveSnapshot"("organizationId", "expiresAt");

-- CreateIndex
CREATE INDEX "SentryDispute_clientId_idx" ON "SentryDispute"("clientId");

-- CreateIndex
CREATE INDEX "SentryDispute_organizationId_idx" ON "SentryDispute"("organizationId");

-- CreateIndex
CREATE INDEX "SentryDispute_status_idx" ON "SentryDispute"("status");

-- CreateIndex
CREATE INDEX "SentryDispute_cra_round_idx" ON "SentryDispute"("cra", "round");

-- CreateIndex
CREATE INDEX "SentryDisputeItem_sentryDisputeId_idx" ON "SentryDisputeItem"("sentryDisputeId");

-- CreateIndex
CREATE INDEX "SentryDisputeItem_accountItemId_idx" ON "SentryDisputeItem"("accountItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SentryAnalysis_sentryDisputeId_key" ON "SentryAnalysis"("sentryDisputeId");

-- CreateIndex
CREATE UNIQUE INDEX "FurnisherProfile_name_key" ON "FurnisherProfile"("name");

-- CreateIndex
CREATE INDEX "FurnisherProfile_normalizedName_idx" ON "FurnisherProfile"("normalizedName");

-- CreateIndex
CREATE INDEX "SentryCodeOutcome_code_idx" ON "SentryCodeOutcome"("code");

-- CreateIndex
CREATE INDEX "SentryCodeOutcome_furnisherName_idx" ON "SentryCodeOutcome"("furnisherName");

-- CreateIndex
CREATE INDEX "SentryCodeOutcome_sentryDisputeId_idx" ON "SentryCodeOutcome"("sentryDisputeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditReport" ADD CONSTRAINT "CreditReport_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditReport" ADD CONSTRAINT "CreditReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditReport" ADD CONSTRAINT "CreditReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditReport" ADD CONSTRAINT "CreditReport_originalFileId_fkey" FOREIGN KEY ("originalFileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountItem" ADD CONSTRAINT "AccountItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountItem" ADD CONSTRAINT "AccountItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CreditReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiffResult" ADD CONSTRAINT "DiffResult_newReportId_fkey" FOREIGN KEY ("newReportId") REFERENCES "CreditReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiffResult" ADD CONSTRAINT "DiffResult_priorReportId_fkey" FOREIGN KEY ("priorReportId") REFERENCES "CreditReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiffChange" ADD CONSTRAINT "DiffChange_newAccountId_fkey" FOREIGN KEY ("newAccountId") REFERENCES "AccountItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiffChange" ADD CONSTRAINT "DiffChange_oldAccountId_fkey" FOREIGN KEY ("oldAccountId") REFERENCES "AccountItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiffChange" ADD CONSTRAINT "DiffChange_diffResultId_fkey" FOREIGN KEY ("diffResultId") REFERENCES "DiffResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeItem" ADD CONSTRAINT "DisputeItem_accountItemId_fkey" FOREIGN KEY ("accountItemId") REFERENCES "AccountItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeItem" ADD CONSTRAINT "DisputeItem_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeResponse" ADD CONSTRAINT "DisputeResponse_disputeItemId_fkey" FOREIGN KEY ("disputeItemId") REFERENCES "DisputeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_generatedFileId_fkey" FOREIGN KEY ("generatedFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentEvidence" ADD CONSTRAINT "DocumentEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentEvidence" ADD CONSTRAINT "DocumentEvidence_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_accountItemId_fkey" FOREIGN KEY ("accountItemId") REFERENCES "AccountItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_renderedFileId_fkey" FOREIGN KEY ("renderedFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingEvidence" ADD CONSTRAINT "PendingEvidence_accountItemId_fkey" FOREIGN KEY ("accountItemId") REFERENCES "AccountItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingEvidence" ADD CONSTRAINT "PendingEvidence_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CreditReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingEvidence" ADD CONSTRAINT "PendingEvidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatuteContent" ADD CONSTRAINT "StatuteContent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterTemplate" ADD CONSTRAINT "LetterTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditScore" ADD CONSTRAINT "CreditScore_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalInfoDispute" ADD CONSTRAINT "PersonalInfoDispute_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientArchiveSnapshot" ADD CONSTRAINT "ClientArchiveSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientArchiveSnapshot" ADD CONSTRAINT "ClientArchiveSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentryDispute" ADD CONSTRAINT "SentryDispute_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentryDisputeItem" ADD CONSTRAINT "SentryDisputeItem_sentryDisputeId_fkey" FOREIGN KEY ("sentryDisputeId") REFERENCES "SentryDispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentryDisputeItem" ADD CONSTRAINT "SentryDisputeItem_accountItemId_fkey" FOREIGN KEY ("accountItemId") REFERENCES "AccountItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentryAnalysis" ADD CONSTRAINT "SentryAnalysis_sentryDisputeId_fkey" FOREIGN KEY ("sentryDisputeId") REFERENCES "SentryDispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

┌─────────────────────────────────────────────────────────┐
│  Update available 5.22.0 -> 7.3.0                       │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘
