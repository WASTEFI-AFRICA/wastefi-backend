-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('COLLECTOR', 'ADMIN', 'COLLECTION_POINT', 'VERIFIER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "KYCStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('WASTE_COLLECTION', 'PAYMENT', 'WITHDRAWAL', 'REFUND', 'BONUS');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('STELLAR', 'MPESA', 'MTN_MONEY', 'AIRTEL_MONEY', 'BANK_TRANSFER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'COLLECTOR',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "kycStatus" "KYCStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "nationalId" TEXT,
    "idDocumentUrl" TEXT,
    "photoUrl" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Kenya',
    "stellarPublicKey" TEXT,
    "stellarSecretKey" TEXT,
    "mobileMoneyNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_points" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Kenya',
    "contactPerson" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TIMESTAMP(3),
    "operatingHours" TEXT,
    "acceptedMaterials" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waste_collections" (
    "id" TEXT NOT NULL,
    "collectorId" TEXT NOT NULL,
    "collectionPointId" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "materialCategory" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER,
    "imageUrls" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "materialPassportId" TEXT,
    "recycleGraphId" TEXT,
    "qualityGrade" TEXT,
    "paymentAmount" DOUBLE PRECISION NOT NULL,
    "paymentCurrency" TEXT NOT NULL DEFAULT 'KES',
    "paymentStatus" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waste_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "externalId" TEXT,
    "referenceNumber" TEXT,
    "stellarTxHash" TEXT,
    "stellarMemo" TEXT,
    "mobileMoneyRef" TEXT,
    "phoneNumber" TEXT,
    "description" TEXT,
    "metadata" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_passports" (
    "id" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "materialCategory" TEXT NOT NULL,
    "productName" TEXT,
    "manufacturer" TEXT,
    "weight" DOUBLE PRECISION NOT NULL,
    "dimensions" TEXT,
    "color" TEXT,
    "composition" TEXT,
    "manufacturingDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "recyclingInstructions" TEXT,
    "currentLocation" TEXT,
    "chainOfCustody" TEXT NOT NULL,
    "recycleGraphId" TEXT,
    "digitalSignature" TEXT,
    "carbonFootprint" DOUBLE PRECISION,
    "carbonCreditsEarned" DOUBLE PRECISION,
    "verifiedAt" TIMESTAMP(3),
    "verificationMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_passports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- CreateIndex
CREATE INDEX "users_phoneNumber_idx" ON "users"("phoneNumber");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "collection_points_latitude_longitude_idx" ON "collection_points"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "collection_points_isActive_idx" ON "collection_points"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "waste_collections_materialPassportId_key" ON "waste_collections"("materialPassportId");

-- CreateIndex
CREATE INDEX "waste_collections_collectorId_idx" ON "waste_collections"("collectorId");

-- CreateIndex
CREATE INDEX "waste_collections_collectionPointId_idx" ON "waste_collections"("collectionPointId");

-- CreateIndex
CREATE INDEX "waste_collections_materialType_idx" ON "waste_collections"("materialType");

-- CreateIndex
CREATE INDEX "waste_collections_createdAt_idx" ON "waste_collections"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_referenceNumber_key" ON "transactions"("referenceNumber");

-- CreateIndex
CREATE INDEX "transactions_userId_idx" ON "transactions"("userId");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "transactions_createdAt_idx" ON "transactions"("createdAt");

-- CreateIndex
CREATE INDEX "transactions_referenceNumber_idx" ON "transactions"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_key_idx" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "material_passports_recycleGraphId_key" ON "material_passports"("recycleGraphId");

-- CreateIndex
CREATE INDEX "material_passports_materialType_idx" ON "material_passports"("materialType");

-- CreateIndex
CREATE INDEX "material_passports_recycleGraphId_idx" ON "material_passports"("recycleGraphId");

-- CreateIndex
CREATE INDEX "system_logs_level_idx" ON "system_logs"("level");

-- CreateIndex
CREATE INDEX "system_logs_service_idx" ON "system_logs"("service");

-- CreateIndex
CREATE INDEX "system_logs_createdAt_idx" ON "system_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "waste_collections" ADD CONSTRAINT "waste_collections_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_collections" ADD CONSTRAINT "waste_collections_collectionPointId_fkey" FOREIGN KEY ("collectionPointId") REFERENCES "collection_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
