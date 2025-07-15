/**
 * Simple measurement conversions for common cooking units
 * These are approximate conversions for cooking purposes
 */

// Conversion factors to grams
const TO_GRAMS: Record<string, Record<string, number>> = {
  // Common baking ingredients
  'flour': {
    'cup': 120,
    'tablespoon': 7.5,
    'teaspoon': 2.5,
    'ounce': 28.35,
    'pound': 453.6,
  },
  'sugar': {
    'cup': 200,
    'tablespoon': 12.5,
    'teaspoon': 4.2,
    'ounce': 28.35,
    'pound': 453.6,
  },
  'butter': {
    'cup': 227,
    'tablespoon': 14.2,
    'teaspoon': 4.7,
    'ounce': 28.35,
    'pound': 453.6,
    'stick': 113, // US butter stick
  },
  'milk': {
    'cup': 240,
    'tablespoon': 15,
    'teaspoon': 5,
    'ounce': 30, // fluid ounce
    'pint': 480,
    'quart': 960,
  },
  'water': {
    'cup': 237,
    'tablespoon': 14.8,
    'teaspoon': 4.9,
    'ounce': 29.6, // fluid ounce
    'pint': 473,
    'quart': 946,
    'liter': 1000,
    'milliliter': 1,
  },
  // Default for ingredients not listed
  'default': {
    'cup': 237,
    'tablespoon': 14.8,
    'teaspoon': 4.9,
    'ounce': 28.35,
    'pound': 453.6,
  }
};

// Volume conversions (milliliters)
const TO_ML: Record<string, number> = {
  'cup': 237,
  'tablespoon': 14.8,
  'teaspoon': 4.9,
  'fluid ounce': 29.6,
  'ounce': 29.6, // assume fluid ounce for liquids
  'pint': 473,
  'quart': 946,
  'gallon': 3785,
  'liter': 1000,
  'milliliter': 1,
};

// Weight conversions (to grams)
const WEIGHT_TO_GRAMS: Record<string, number> = {
  'gram': 1,
  'kilogram': 1000,
  'ounce': 28.35,
  'pound': 453.6,
};

// Volume conversions between units
const VOLUME_CONVERSIONS: Record<string, Record<string, number>> = {
  'cup': {
    'tablespoon': 16,
    'teaspoon': 48,
    'fluid ounce': 8,
    'milliliter': 237,
    'liter': 0.237,
  },
  'tablespoon': {
    'cup': 0.0625,
    'teaspoon': 3,
    'fluid ounce': 0.5,
    'milliliter': 14.8,
  },
  'teaspoon': {
    'cup': 0.0208,
    'tablespoon': 0.333,
    'fluid ounce': 0.167,
    'milliliter': 4.9,
  }
};

export interface SimpleConversionResult {
  success: boolean;
  convertedValue?: number;
  unit?: string;
  error?: string;
  method?: 'simple' | 'api';
}

/**
 * Simple conversion function for common cooking measurements
 */
export function simpleConvert(
  ingredient: string,
  fromUnit: string,
  toUnit: string,
  value: number
): SimpleConversionResult {
  // Normalize units
  const from = fromUnit.toLowerCase().replace(/s$/, '');
  const to = toUnit.toLowerCase().replace(/s$/, '');
  
  // Same unit, no conversion needed
  if (from === to) {
    return { success: true, convertedValue: value, unit: toUnit, method: 'simple' };
  }

  // Try weight conversions
  if (WEIGHT_TO_GRAMS[from] && WEIGHT_TO_GRAMS[to]) {
    const inGrams = value * WEIGHT_TO_GRAMS[from];
    const converted = inGrams / WEIGHT_TO_GRAMS[to];
    return { 
      success: true, 
      convertedValue: Math.round(converted * 100) / 100,
      unit: toUnit,
      method: 'simple'
    };
  }

  // Try volume conversions
  if (TO_ML[from] && TO_ML[to]) {
    const inML = value * TO_ML[from];
    const converted = inML / TO_ML[to];
    return { 
      success: true, 
      convertedValue: Math.round(converted * 100) / 100,
      unit: toUnit,
      method: 'simple'
    };
  }

  // Try ingredient-specific conversions to grams
  if (to === 'gram' || to === 'grams') {
    const ingredientLower = ingredient.toLowerCase();
    const conversions = TO_GRAMS[ingredientLower] || TO_GRAMS['default'];
    
    if (conversions[from]) {
      const converted = value * conversions[from];
      return { 
        success: true, 
        convertedValue: Math.round(converted),
        unit: 'grams',
        method: 'simple'
      };
    }
  }

  // Try converting from grams to other units
  if (from === 'gram' || from === 'grams') {
    const ingredientLower = ingredient.toLowerCase();
    const conversions = TO_GRAMS[ingredientLower] || TO_GRAMS['default'];
    
    if (conversions[to]) {
      const converted = value / conversions[to];
      return { 
        success: true, 
        convertedValue: Math.round(converted * 100) / 100,
        unit: toUnit,
        method: 'simple'
      };
    }
  }

  // Try direct volume conversions
  if (VOLUME_CONVERSIONS[from] && VOLUME_CONVERSIONS[from][to]) {
    const converted = value * VOLUME_CONVERSIONS[from][to];
    return { 
      success: true, 
      convertedValue: Math.round(converted * 100) / 100,
      unit: toUnit,
      method: 'simple'
    };
  }

  // Reverse volume conversions
  if (VOLUME_CONVERSIONS[to] && VOLUME_CONVERSIONS[to][from]) {
    const converted = value / VOLUME_CONVERSIONS[to][from];
    return { 
      success: true, 
      convertedValue: Math.round(converted * 100) / 100,
      unit: toUnit,
      method: 'simple'
    };
  }

  return { 
    success: false, 
    error: `Cannot convert ${fromUnit} to ${toUnit} for ${ingredient}` 
  };
}