-- AlterTable
ALTER TABLE "GenerationJob"
ADD COLUMN "runpodRequestId" TEXT,
ADD COLUMN "outputKey" TEXT,
ADD COLUMN "errorMessage" TEXT;

-- CreateIndex
CREATE INDEX "GenerationJob_runpodRequestId_idx" ON "GenerationJob"("runpodRequestId");
