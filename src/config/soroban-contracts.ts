export type CollectionFlow = 'admin_v1' | 'point_owner_v1';

/**
 * The WasteFi contracts deployed on Stellar testnet.
 *
 * Copied from deployed_addresses_testnet.json in wastefi-contracts, which
 * scripts/deploy-testnet.sh rewrites on every deployment. Update this file when that
 * one changes, or override it without a code change by setting SOROBAN_CONTRACTS to
 * the `contracts` object of that file as JSON.
 */
export interface SorobanContracts {
  waste_token: string;
  collector_registry: string;
  collection_point: string;
  material_pricing: string;
  reputation: string;
  waste_transaction: string;
  payment_distribution: string;
}

export const TESTNET_CONTRACTS: SorobanContracts = {
  waste_token: 'CDOK6OEYIINSA2KP23UU72BSNST7PFNVD67DI2PDELCZIQYUV7XK7SH6',
  collector_registry: 'CCP4QOY57OKA6DNRU2XG5AD5B2YSVNSUG7BRVWR5XJRDMGY62VQ7JHII',
  collection_point: 'CADEZ64CHYORQLRKD3JLV6QLW7IHJAUWEAAOPS6K2DNMQSXZCSPLGMHW',
  material_pricing: 'CA6BP7PC7OPZPT4MFHIJAPXB237BVP72GVNVPI67GPH3QYYBCJDN2Z5G',
  reputation: 'CCXDYT3RIM2D356CYUZJ7SVD5PRFUVNJDZDAKSI5WITMMW5QMXZHIB5A',
  waste_transaction: 'CB77D77P7RLXHPXNCZG4PJE6OVAXWYWAY2KBDX2SO76FMSBL7XOTYDIT',
  payment_distribution: 'CA5BJ6WCZEVLV7YNZY7XXERXSDHSYMW5XKCQOU3BTXWNG2DQRR74PB2W',
};

export function resolveSorobanContracts(): SorobanContracts {
  const override = process.env.SOROBAN_CONTRACTS;
  if (!override) return TESTNET_CONTRACTS;
  const parsed = JSON.parse(override) as Partial<SorobanContracts>;
  return { ...TESTNET_CONTRACTS, ...parsed };
}
