import { MaterialPricingUtil } from '../../../src/utils/material-pricing.util';

describe('Material Pricing Utility', () => {
  describe('getPrice', () => {
    it('should return correct price object for PET', () => {
      const material = MaterialPricingUtil.getPrice('PET');
      expect(material).toBeDefined();
      expect(material?.pricePerKg).toBe(25);
      expect(material?.category).toBe('Plastic');
    });

    it('should return correct price object for ALUMINUM', () => {
      const material = MaterialPricingUtil.getPrice('ALUMINUM');
      expect(material).toBeDefined();
      expect(material?.pricePerKg).toBe(80);
      expect(material?.category).toBe('Metal');
    });

    it('should be case insensitive', () => {
      const pet1 = MaterialPricingUtil.getPrice('pet');
      const pet2 = MaterialPricingUtil.getPrice('PET');
      const pet3 = MaterialPricingUtil.getPrice('Pet');

      expect(pet1?.pricePerKg).toBe(25);
      expect(pet2?.pricePerKg).toBe(25);
      expect(pet3?.pricePerKg).toBe(25);
    });

    it('should return null for unknown material', () => {
      const material = MaterialPricingUtil.getPrice('Unknown Material');
      expect(material).toBeNull();
    });

    it('should return null for empty string', () => {
      const material = MaterialPricingUtil.getPrice('');
      expect(material).toBeNull();
    });

    it('should return prices for all known materials', () => {
      const knownMaterials = Object.keys(MaterialPricingUtil.getAllPrices());

      knownMaterials.forEach((material) => {
        const price = MaterialPricingUtil.getPrice(material);
        expect(price).toBeDefined();
        expect(price?.pricePerKg).toBeGreaterThan(0);
      });
    });
  });

  describe('calculatePayment', () => {
    it('should calculate correct value without bonus', () => {
      const value = MaterialPricingUtil.calculatePayment('PET', 10);
      expect(value).toBe(250); // 10 kg * 25 KES/kg
    });

    it('should apply 5% bonus for 50+ kg', () => {
      const value = MaterialPricingUtil.calculatePayment('PET', 50);
      // 50 * 25 * 1.05 = 1312.5
      expect(value).toBe(1312.5);
    });

    it('should apply 10% bonus for 100+ kg', () => {
      const value = MaterialPricingUtil.calculatePayment('ALUMINUM', 100);
      const expected = Math.round(100 * 80 * 1.1);
      expect(value).toBe(expected);
    });

    it('should not apply bonus for 49.9 kg', () => {
      const value = MaterialPricingUtil.calculatePayment('PET', 49.9);
      expect(value).toBeCloseTo(49.9 * 25, 0); // No bonus
    });

    it('should apply correct bonus at boundary (exactly 50 kg)', () => {
      const value = MaterialPricingUtil.calculatePayment('PET', 50);
      expect(value).toBeGreaterThan(50 * 25); // Should have bonus
    });

    it('should apply correct bonus at boundary (exactly 100 kg)', () => {
      const value = MaterialPricingUtil.calculatePayment('PET', 100);
      expect(value).toBeGreaterThan(100 * 25 * 1.05); // Should have 10% bonus
    });

    it('should handle decimal weights', () => {
      const value = MaterialPricingUtil.calculatePayment('PET', 5.5);
      expect(value).toBeCloseTo(5.5 * 25, 0);
    });

    it('should return default price for unknown material', () => {
      const value = MaterialPricingUtil.calculatePayment('Unknown Material', 10);
      // Unknown materials get 10 KES/kg default rate
      expect(value).toBe(100); // 10 * 10
    });

    it('should return 0 for zero weight', () => {
      const value = MaterialPricingUtil.calculatePayment('PET', 0);
      expect(value).toBe(0);
    });

    it('should calculate negative weight', () => {
      const value = MaterialPricingUtil.calculatePayment('PET', -10);
      // Negative weight just calculates as negative amount
      expect(value).toBe(-250); // -10 * 25
    });

    it('should be case insensitive for material type', () => {
      const value1 = MaterialPricingUtil.calculatePayment('PET', 10);
      const value2 = MaterialPricingUtil.calculatePayment('pet', 10);
      const value3 = MaterialPricingUtil.calculatePayment('Pet', 10);

      expect(value1).toBe(value2);
      expect(value2).toBe(value3);
    });

    it('should calculate correctly for various material types', () => {
      const testCases = [
        { material: 'PET', weight: 10, minExpected: 200 },
        { material: 'HDPE', weight: 10, minExpected: 250 },
        { material: 'ALUMINUM', weight: 10, minExpected: 700 },
        { material: 'STEEL', weight: 10, minExpected: 100 },
      ];

      testCases.forEach(({ material, weight, minExpected }) => {
        const value = MaterialPricingUtil.calculatePayment(material, weight);
        expect(value).toBeGreaterThanOrEqual(minExpected);
      });
    });

    it('should maintain precision for decimal calculations', () => {
      const value = MaterialPricingUtil.calculatePayment('PET', 5.55);
      expect(value).toBeCloseTo(138.75, 0);
    });

    it('should handle very large weights', () => {
      const value = MaterialPricingUtil.calculatePayment('PET', 1000);
      expect(value).toBeGreaterThan(1000 * 25); // Should have 10% bonus
    });

    it('should handle very small weights', () => {
      const value = MaterialPricingUtil.calculatePayment('PET', 0.01);
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(1);
    });
  });

  describe('getAllPrices', () => {
    it('should return all material prices', () => {
      const prices = MaterialPricingUtil.getAllPrices();

      expect(prices).toBeDefined();
      expect(Object.keys(prices).length).toBeGreaterThan(10);
    });

    it('should have all prices as valid objects', () => {
      const prices = MaterialPricingUtil.getAllPrices();

      Object.values(prices).forEach((material) => {
        expect(material).toHaveProperty('pricePerKg');
        expect(material).toHaveProperty('category');
        expect(material).toHaveProperty('description');
        expect(typeof material.pricePerKg).toBe('number');
        expect(material.pricePerKg).toBeGreaterThan(0);
        expect(Number.isFinite(material.pricePerKg)).toBe(true);
      });
    });

    it('should have reasonable price ranges', () => {
      const prices = MaterialPricingUtil.getAllPrices();

      Object.entries(prices).forEach(([_material, data]) => {
        expect(data.pricePerKg).toBeGreaterThanOrEqual(3);
        expect(data.pricePerKg).toBeLessThanOrEqual(650); // COPPER is 600
      });
    });
  });

  describe('isValidMaterialType', () => {
    it('should return true for valid materials', () => {
      expect(MaterialPricingUtil.isValidMaterialType('PET')).toBe(true);
      expect(MaterialPricingUtil.isValidMaterialType('ALUMINUM')).toBe(true);
    });

    it('should return false for invalid materials', () => {
      expect(MaterialPricingUtil.isValidMaterialType('INVALID')).toBe(false);
      expect(MaterialPricingUtil.isValidMaterialType('')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(MaterialPricingUtil.isValidMaterialType('pet')).toBe(true);
      expect(MaterialPricingUtil.isValidMaterialType('PET')).toBe(true);
      expect(MaterialPricingUtil.isValidMaterialType('Pet')).toBe(true);
    });
  });
});
