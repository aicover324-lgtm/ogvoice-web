-- AlterTable
ALTER TABLE "VoiceProfile" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- DropIndex
DROP INDEX IF EXISTS "VoiceProfile_userId_createdAt_idx";

-- CreateIndex
CREATE INDEX "VoiceProfile_userId_deletedAt_createdAt_idx" ON "VoiceProfile"("userId", "deletedAt", "createdAt");
