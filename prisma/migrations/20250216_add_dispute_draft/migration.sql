-- CreateTable
CREATE TABLE "DisputeDraft" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "letterContent" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "cra" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "accountIds" TEXT NOT NULL DEFAULT '[]',
    "letterFormat" TEXT NOT NULL DEFAULT 'STRUCTURED',
    "ameliaMetadata" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisputeDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisputeDraft_clientId_idx" ON "DisputeDraft"("clientId");

-- CreateIndex
CREATE INDEX "DisputeDraft_organizationId_idx" ON "DisputeDraft"("organizationId");

-- CreateIndex
CREATE INDEX "DisputeDraft_status_expiresAt_idx" ON "DisputeDraft"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "DisputeDraft_contentHash_idx" ON "DisputeDraft"("contentHash");

-- AddForeignKey
ALTER TABLE "DisputeDraft" ADD CONSTRAINT "DisputeDraft_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeDraft" ADD CONSTRAINT "DisputeDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
