-- Contract addresses and signing identities must survive deployment changes.
-- Existing on-chain rows are pinned by the explicit backfill command, using the
-- original deployment. Rows with progress but no context fail closed on retry.
ALTER TABLE "waste_collections" ADD COLUMN "chainContext" JSONB;

-- A payment mapping belongs to one transaction namespace on one network.
CREATE TABLE "chain_payment_namespaces" (
    "networkPassphrase" TEXT NOT NULL,
    "paymentContract" TEXT NOT NULL,
    "transactionContract" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chain_payment_namespaces_pkey" PRIMARY KEY ("networkPassphrase", "paymentContract")
);
