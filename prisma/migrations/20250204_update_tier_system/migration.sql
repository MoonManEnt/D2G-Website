-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "isFoundingMember" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "foundingMemberNumber" INTEGER;
ALTER TABLE "Organization" ADD COLUMN "foundingMemberLockedPrice" DOUBLE PRECISION;
ALTER TABLE "Organization" ADD COLUMN "storageUsedBytes" BIGINT NOT NULL DEFAULT 0;
