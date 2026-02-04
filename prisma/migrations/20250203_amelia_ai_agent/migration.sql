-- Amelia AI Agent: Conversation, Message, Recommendation Cache, and Outcome Pattern tables

-- AmeliaConversation: Chat sessions between specialists and Amelia
CREATE TABLE "AmeliaConversation" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "userId" TEXT NOT NULL,
    "clientId" TEXT,
    "disputeId" TEXT,
    "organizationId" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmeliaConversation_pkey" PRIMARY KEY ("id")
);

-- AmeliaMessage: Individual messages within a conversation
CREATE TABLE "AmeliaMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmeliaMessage_pkey" PRIMARY KEY ("id")
);

-- AmeliaRecommendationCache: Precomputed recommendations for dashboard
CREATE TABLE "AmeliaRecommendationCache" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cacheType" TEXT NOT NULL,
    "clientId" TEXT,
    "content" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmeliaRecommendationCache_pkey" PRIMARY KEY ("id")
);

-- AmeliaOutcomePattern: Learned dispute outcome patterns
CREATE TABLE "AmeliaOutcomePattern" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cra" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "creditorName" TEXT,
    "accountType" TEXT,
    "totalDisputes" INTEGER NOT NULL DEFAULT 0,
    "deletions" INTEGER NOT NULL DEFAULT 0,
    "verifiedOnly" INTEGER NOT NULL DEFAULT 0,
    "noResponse" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgDaysToResolve" DOUBLE PRECISION,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "isReliable" BOOLEAN NOT NULL DEFAULT false,
    "lastComputedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmeliaOutcomePattern_pkey" PRIMARY KEY ("id")
);

-- Indexes for AmeliaConversation
CREATE INDEX "AmeliaConversation_userId_idx" ON "AmeliaConversation"("userId");
CREATE INDEX "AmeliaConversation_clientId_idx" ON "AmeliaConversation"("clientId");
CREATE INDEX "AmeliaConversation_organizationId_idx" ON "AmeliaConversation"("organizationId");
CREATE INDEX "AmeliaConversation_organizationId_updatedAt_idx" ON "AmeliaConversation"("organizationId", "updatedAt");

-- Indexes for AmeliaMessage
CREATE INDEX "AmeliaMessage_conversationId_idx" ON "AmeliaMessage"("conversationId");
CREATE INDEX "AmeliaMessage_conversationId_createdAt_idx" ON "AmeliaMessage"("conversationId", "createdAt");

-- Indexes for AmeliaRecommendationCache
CREATE INDEX "AmeliaRecommendationCache_organizationId_idx" ON "AmeliaRecommendationCache"("organizationId");
CREATE INDEX "AmeliaRecommendationCache_organizationId_cacheType_idx" ON "AmeliaRecommendationCache"("organizationId", "cacheType");
CREATE INDEX "AmeliaRecommendationCache_expiresAt_idx" ON "AmeliaRecommendationCache"("expiresAt");
CREATE INDEX "AmeliaRecommendationCache_clientId_idx" ON "AmeliaRecommendationCache"("clientId");

-- Indexes for AmeliaOutcomePattern
CREATE UNIQUE INDEX "AmeliaOutcomePattern_organizationId_cra_flow_creditorName_accountType_key" ON "AmeliaOutcomePattern"("organizationId", "cra", "flow", "creditorName", "accountType");
CREATE INDEX "AmeliaOutcomePattern_organizationId_idx" ON "AmeliaOutcomePattern"("organizationId");
CREATE INDEX "AmeliaOutcomePattern_organizationId_cra_idx" ON "AmeliaOutcomePattern"("organizationId", "cra");
CREATE INDEX "AmeliaOutcomePattern_organizationId_cra_flow_idx" ON "AmeliaOutcomePattern"("organizationId", "cra", "flow");
CREATE INDEX "AmeliaOutcomePattern_successRate_idx" ON "AmeliaOutcomePattern"("successRate");

-- Foreign keys
ALTER TABLE "AmeliaConversation" ADD CONSTRAINT "AmeliaConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AmeliaConversation" ADD CONSTRAINT "AmeliaConversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AmeliaMessage" ADD CONSTRAINT "AmeliaMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AmeliaConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
