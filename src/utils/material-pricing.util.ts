/**
 * Material pricing utility for calculating payments
 * Prices are in KES (Kenyan Shillings) per kilogram
 */

interface MaterialPrice {
  pricePerKg: number;
  category: string;
  description: string;
}

export class MaterialPricingUtil {
  // Pricing table (KES per kg)
  private static readonly PRICES: Record<string, MaterialPrice> = {
    // Plastics
    PET: {
      pricePerKg: 25,
      category: 'Plastic',
      description: 'PET bottles (water, soda)',
    },
    HDPE: {
      pricePerKg: 30,
      category: 'Plastic',
      description: 'HDPE containers (milk jugs, detergent)',
    },
    PVC: {
      pricePerKg: 15,
      category: 'Plastic',
      description: 'PVC pipes and containers',
    },
    LDPE: {
      pricePerKg: 20,
      category: 'Plastic',
      description: 'LDPE bags and films',
    },
    PP: {
      pricePerKg: 22,
      category: 'Plastic',
      description: 'PP containers and caps',
    },
    PS: {
      pricePerKg: 10,
      category: 'Plastic',
      description: 'Polystyrene foam',
    },

    // Metals
    ALUMINUM: {
      pricePerKg: 80,
      category: 'Metal',
      description: 'Aluminum cans and products',
    },
    STEEL: {
      pricePerKg: 15,
      category: 'Metal',
      description: 'Steel cans and scrap',
    },
    COPPER: {
      pricePerKg: 600,
      category: 'Metal',
      description: 'Copper wire and products',
    },
    BRASS: {
      pricePerKg: 400,
      category: 'Metal',
      description: 'Brass products',
    },

    // Glass
    GLASS_CLEAR: {
      pricePerKg: 5,
      category: 'Glass',
      description: 'Clear glass bottles',
    },
    GLASS_COLORED: {
      pricePerKg: 3,
      category: 'Glass',
      description: 'Colored glass bottles',
    },

    // Paper
    CARDBOARD: {
      pricePerKg: 8,
      category: 'Paper',
      description: 'Corrugated cardboard',
    },
    PAPER_WHITE: {
      pricePerKg: 12,
      category: 'Paper',
      description: 'White office paper',
    },
    PAPER_MIXED: {
      pricePerKg: 6,
      category: 'Paper',
      description: 'Mixed paper',
    },
    NEWSPAPER: {
      pricePerKg: 4,
      category: 'Paper',
      description: 'Newspapers and magazines',
    },

    // Electronics
    E_WASTE: {
      pricePerKg: 50,
      category: 'Electronics',
      description: 'Electronic waste',
    },

    // Other
    TEXTILE: {
      pricePerKg: 10,
      category: 'Textile',
      description: 'Used textiles and clothes',
    },
    RUBBER: {
      pricePerKg: 20,
      category: 'Rubber',
      description: 'Rubber products',
    },
  };

  /**
   * Calculate payment for a material collection
   */
  static calculatePayment(materialType: string, weight: number): number {
    const material = this.PRICES[materialType.toUpperCase()];

    if (!material) {
      // Default price for unknown materials
      return weight * 10;
    }

    const baseAmount = weight * material.pricePerKg;

    // Apply quantity discount for large collections
    let discount = 0;
    if (weight >= 100) {
      discount = 0.1; // 10% discount for 100kg+
    } else if (weight >= 50) {
      discount = 0.05; // 5% discount for 50kg+
    }

    const discountedAmount = baseAmount * (1 + discount);

    // Round to 2 decimal places
    return Math.round(discountedAmount * 100) / 100;
  }

  /**
   * Get price for a material type
   */
  static getPrice(materialType: string): MaterialPrice | null {
    return this.PRICES[materialType.toUpperCase()] || null;
  }

  /**
   * Get all material prices
   */
  static getAllPrices(): Record<string, MaterialPrice> {
    return { ...this.PRICES };
  }

  /**
   * Get materials by category
   */
  static getMaterialsByCategory(category: string): string[] {
    return Object.entries(this.PRICES)
      .filter(([, price]) => price.category.toLowerCase() === category.toLowerCase())
      .map(([type]) => type);
  }

  /**
   * Calculate estimated earnings for planned collection
   */
  static estimateEarnings(
    materialType: string,
    weight: number
  ): {
    baseAmount: number;
    bonus: number;
    total: number;
    pricePerKg: number;
  } {
    const material = this.PRICES[materialType.toUpperCase()];
    const pricePerKg = material?.pricePerKg || 10;
    const baseAmount = weight * pricePerKg;

    let bonusPercent = 0;
    if (weight >= 100) {
      bonusPercent = 0.1;
    } else if (weight >= 50) {
      bonusPercent = 0.05;
    }

    const bonus = baseAmount * bonusPercent;
    const total = baseAmount + bonus;

    return {
      baseAmount: Math.round(baseAmount * 100) / 100,
      bonus: Math.round(bonus * 100) / 100,
      total: Math.round(total * 100) / 100,
      pricePerKg,
    };
  }

  /**
   * Validate material type
   */
  static isValidMaterialType(materialType: string): boolean {
    return materialType.toUpperCase() in this.PRICES;
  }

  /**
   * Get material categories
   */
  static getCategories(): string[] {
    const categories = new Set<string>();
    Object.values(this.PRICES).forEach((price) => {
      categories.add(price.category);
    });
    return Array.from(categories);
  }

  /**
   * Format amount for display
   */
  static formatAmount(amount: number, currency: string = 'KES'): string {
    return `${currency} ${amount.toFixed(2)}`;
  }

  /**
   * Calculate platform fee (for future use)
   */
  static calculatePlatformFee(amount: number, feePercent: number = 2): number {
    return Math.round(amount * (feePercent / 100) * 100) / 100;
  }
}
