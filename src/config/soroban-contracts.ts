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
  collection_point: 'CDDY7OUFFZ32K2FCISKMKN2B7BPPFW7PS7OE4GHFXX5WR4547C4MOA34',
  material_pricing: 'CA6BP7PC7OPZPT4MFHIJAPXB237BVP72GVNVPI67GPH3QYYBCJDN2Z5G',
  reputation: 'CCXDYT3RIM2D356CYUZJ7SVD5PRFUVNJDZDAKSI5WITMMW5QMXZHIB5A',
  waste_transaction: 'CAFC4QX3LOQKTPZLWJ52XXE7H5NO7PGVBG4IVGA4BN3E6YT6TIDDL7UP',
  payment_distribution: 'CARON3S57TTYVHG7C3DMOGIQH5GSYTAOOH325AOX5KQJRYGSFD3RT2JO',
};

export function resolveSorobanContracts(): SorobanContracts {
  const override = process.env.SOROBAN_CONTRACTS;
  if (!override) return TESTNET_CONTRACTS;
  const parsed = JSON.parse(override) as Partial<SorobanContracts>;
  return { ...TESTNET_CONTRACTS, ...parsed };
}
