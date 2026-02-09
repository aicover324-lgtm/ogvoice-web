/*
  Warnings:

  - You are about to drop the `RunnerToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RunnerToken" DROP CONSTRAINT "RunnerToken_userId_fkey";

-- AlterTable
ALTER TABLE "TrainingJob" ADD COLUMN     "artifactKey" TEXT,
ADD COLUMN     "datasetAssetId" TEXT,
ADD COLUMN     "datasetKey" TEXT,
ADD COLUMN     "runpodRequestId" TEXT;

-- DropTable
DROP TABLE "RunnerToken";

-- CreateIndex
CREATE INDEX "TrainingJob_runpodRequestId_idx" ON "TrainingJob"("runpodRequestId");
