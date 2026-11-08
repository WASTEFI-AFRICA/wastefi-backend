-- Wallet keys live in a private relation, not in public collection point scalars.
CREATE TABLE "collection_point_wallets" (
    "pointId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "collection_point_wallets_pkey" PRIMARY KEY ("pointId")
);
CREATE UNIQUE INDEX "collection_point_wallets_publicKey_key" ON "collection_point_wallets"("publicKey");
ALTER TABLE "collection_point_wallets" ADD CONSTRAINT "collection_point_wallets_pointId_fkey"
    FOREIGN KEY ("pointId") REFERENCES "collection_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "point_chain_registrations" (
    "pointId" TEXT NOT NULL,
    "networkPassphrase" TEXT NOT NULL,
    "registryContract" TEXT NOT NULL,
    "registrationTxHash" TEXT,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    CONSTRAINT "point_chain_registrations_pkey" PRIMARY KEY ("pointId", "networkPassphrase", "registryContract")
);
ALTER TABLE "point_chain_registrations" ADD CONSTRAINT "point_chain_registrations_pointId_fkey"
    FOREIGN KEY ("pointId") REFERENCES "collection_point_wallets"("pointId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Correct only the unchanged original central demo material list. Preserve edits.
UPDATE "collection_points"
SET "acceptedMaterials" = '["PET","HDPE","ALUMINUM","GLASS_CLEAR","CARDBOARD"]'
WHERE "contactPhone" = '+254700000201'
  AND "name" = 'Nairobi Central Collection Point'
  AND "acceptedMaterials" = '["PET","HDPE","ALUMINUM","GLASS_CLEAR"]';
