import { getMaterialPrice, calculateTotalValue, MATERIAL_PRICES } from '../../../src/utils/material-pricing.util';

describe('Material Pricing Utility', () => {
  describe('getMaterialPrice', () => {
    it('should return correct price for PET Bottles', () => {
      const price = getMaterialPrice('PET Bottles');
      expect(price).toBe(MATERIAL_PRICES['PET Bottles']);
      expect(price).toBe(50);
    });

    it('should return correct price for Aluminum Cans', () => {
      const price = getMaterialPrice('Aluminum Cans');
      expect(price).toBe(MATERIAL_PRICES['Aluminum Cans']);
      expect(price).toBe(80);
    });

    it('should be case insensitive', () => {
      expect(getMaterialPrice('pet bottles')).toBe(50);
      expect(getMaterialPrice('PET BOTTLES')).toBe(50);
      expect(getMaterialPrice('Pet Bottles')).toBe(50);
    });

    it('should return 0 for unknown material', () => {
      const price = getMaterialPrice('Unknown Material');
      expect(price).toBe(0);
    });

    it('should handle empty string', () => {
      const price = getMaterialPrice('');
      expect(price).toBe(0);
    });

    it('should return prices for all known materials', () => {
      const knownMaterials = Object.keys(MATERIAL_PRICES);
      
      knownMaterials.forEach(material => {
        const price = getMaterialPrice(material);
        expect(price).toBeGreaterThan(0);
        expect(typeof price).toBe('number');
      });
    });
  });

  describe('calculateTotalValue', () => {
    it('should calculate correct value without bonus', () => {
      const value = calculateTotalValue('PET Bottles', 10);
      expect(value).toBe(500); // 10 kg * 50 KES/kg
    });

    it('should apply 5% bonus for 50+ kg', () => {
      const value = calculateTotalValue('PET Bottles', 50);
      const expected = 50 * 50 * 1.05; // 2625
      expect(value).toBe(expected);
    });

    it('should apply 10% bonus for 100+ kg', () => {
      const value = calculateTotalValue('Aluminum Cans', 100);
      const expected = 100 * 80 * 1.10; // 8800
      expect(value).toBe(expected);
    });

    it('should not apply bonus for 49.9 kg', () => {
      const value = calculateTotalValue('PET Bottles', 49.9);
      expect(value).toBe(49.9 * 50); // No bonus
    });

    it('should apply correct bonus at boundary (exactly 50 kg)', () => {
      const value = calculateTotalValue('PET Bottles', 50);
      expect(value).toBe(50 * 50 * 1.05);
    });

    it('should apply correct bonus at boundary (exactly 100 kg)', () => {
      const value = calculateTotalValue('PET Bottles', 100);
      expect(value).toBe(100 * 50 * 1.10);
    });

    it('should handle decimal weights', () => {
      const value = calculateTotalValue('PET Bottles', 5.5);
      expect(value).toBe(5.5 * 50);
    });

    it('should return 0 for unknown material', () => {
      const value = calculateTotalValue('Unknown Material', 10);
      expect(value).toBe(0);
    });

    it('should return 0 for zero weight', () => {
      const value = calculateTotalValue('PET Bottles', 0);
      expect(value).toBe(0);
    });

    it('should handle negative weight (return 0)', () => {
      const value = calculateTotalValue('PET Bottles', -10);
      expect(value).toBe(0);
    });

    it('should be case insensitive for material type', () => {
      const value1 = calculateTotalValue('PET Bottles', 10);
      const value2 = calculateTotalValue('pet bottles', 10);
      const value3 = calculateTotalValue('PET BOTTLES', 10);
      
      expect(value1).toBe(value2);
      expect(value2).toBe(value3);
    });

    it('should calculate correctly for all material types', () => {
      const testCases = [
        { material: 'PET Bottles', weight: 10, expectedBase: 500 },
        { material: 'HDPE Containers', weight: 10, expectedBase: 450 },
        { material: 'Aluminum Cans', weight: 10, expectedBase: 800 },
        { material: 'Steel', weight: 10, expectedBase: 300 },
        { material: 'Cardboard', weight: 10, expectedBase: 150 },
        { material: 'White Paper', weight: 10, expectedBase: 200 },
        { material: 'Clear Glass', weight: 10, expectedBase: 100 },
      ];

      testCases.forEach(({ material, weight, expectedBase }) => {
        const value = calculateTotalValue(material, weight);
        expect(value).toBe(expectedBase);
      });
    });

    it('should maintain precision for decimal calculations', () => {
      const value = calculateTotalValue('PET Bottles', 5.55);
      expect(value).toBeCloseTo(277.5, 2);
    });

    it('should handle very large weights', () => {
      const value = calculateTotalValue('PET Bottles', 1000);
      const expected = 1000 * 50 * 1.10; // 10% bonus
      expect(value).toBe(expected);
    });

    it('should handle very small weights', () => {
      const value = calculateTotalValue('PET Bottles', 0.01);
      expect(value).toBe(0.5);
    });
  });

  describe('MATERIAL_PRICES constant', () => {
    it('should have prices for all expected materials', () => {
      const expectedMaterials = [
        'PET Bottles',
        'HDPE Containers',
        'PVC',
        'LDPE',
        'PP',
        'PS',
        'Other Plastics',
        'Aluminum Cans',
        'Steel',
        'Copper',
        'Brass',
        'Other Metals',
        'Cardboard',
        'White Paper',
        'Newspaper',
        'Mixed Paper',
        'Clear Glass',
        'Green Glass',
        'Brown Glass',
        'Mixed Glass',
        'E-Waste',
        'Batteries',
        'Textiles',
        'Organic Waste',
        'Other',
      ];

      expectedMaterials.forEach(material => {
        expect(MATERIAL_PRICES).toHaveProperty(material);
        expect(MATERIAL_PRICES[material]).toBeGreaterThan(0);
      });
    });

    it('should have all prices as numbers', () => {
      Object.values(MATERIAL_PRICES).forEach(price => {
        expect(typeof price).toBe('number');
        expect(price).toBeGreaterThan(0);
        expect(Number.isFinite(price)).toBe(true);
      });
    });

    it('should have reasonable price ranges', () => {
      Object.entries(MATERIAL_PRICES).forEach(([material, price]) => {
        expect(price).toBeGreaterThanOrEqual(5);
        expect(price).toBeLessThanOrEqual(150);
      });
    });
  });
});
