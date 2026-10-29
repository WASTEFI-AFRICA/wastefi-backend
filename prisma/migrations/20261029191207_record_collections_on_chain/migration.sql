-- CreateEnum
CREATE TYPE "ChainStatus" AS ENUM ('PENDING', 'RECORDED', 'VERIFIED', 'PAID', 'FAILED');

-- AlterTable
ALTER TABLE "collection_points" ADD COLUMN     "stellarAddress" TEXT;

-- AlterTable
ALTER TABLE "waste_collections" ADD COLUMN     "chainAmount" TEXT,
ADD COLUMN     "chainAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "chainError" TEXT,
ADD COLUMN     "chainPaymentId" TEXT,
ADD COLUMN     "chainPaymentTxHash" TEXT,
ADD COLUMN     "chainRecordTxHash" TEXT,
ADD COLUMN     "chainStatus" "ChainStatus",
ADD COLUMN     "chainTransactionId" TEXT,
ADD COLUMN     "chainVerifyTxHash" TEXT;

-- CreateIndex
CREATE INDEX "waste_collections_chainStatus_idx" ON "waste_collections"("chainStatus");
