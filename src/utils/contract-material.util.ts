import { MaterialPricingUtil } from './material-pricing.util';

const TYPES: Record<string, string> = {
  plastic: 'Plastic',
  glass: 'Glass',
  metal: 'Metal',
  paper: 'Paper',
  cardboard: 'Cardboard',
  electronics: 'Electronics',
  'e-waste': 'Electronics',
  organic: 'Organic',
  textile: 'Textile',
  rubber: 'Rubber',
};

export function contractMaterialType(category: string): string {
  return TYPES[category.trim().toLowerCase()] ?? 'Other';
}

/** Codes offered by a point, normalized to the existing Soroban material variants. */
export function pointMaterials(stored: string | null): string[] {
  let codes: unknown;
  try {
    codes = stored ? JSON.parse(stored) : null;
  } catch {
    codes = null;
  }
  if (!Array.isArray(codes) || !codes.length || codes.some((code) => typeof code !== 'string')) {
    throw new Error('Point accepted materials need review');
  }
  const materials = new Set<string>();
  for (const code of codes as string[]) {
    const price = MaterialPricingUtil.getPrice(code);
    const category = price ? contractMaterialType(price.category) : contractMaterialType(code);
    if (category === 'Other') throw new Error('Point accepted materials need review');
    materials.add(category);
    // Existing demo records use Cardboard; the public catalog uses Paper for this code.
    if (code.trim().toUpperCase() === 'CARDBOARD') materials.add('Cardboard');
  }
  return [...materials].sort();
}
