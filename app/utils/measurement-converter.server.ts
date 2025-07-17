/**
 * Food Ingredient Measurement Conversion Service
 */

// Common unit mappings to API-compatible format
const UNIT_MAPPINGS: Record<string, string> = {
  // Volume - US
  'cup': 'cup (US)',
  'cups': 'cup (US)',
  'c': 'cup (US)',
  'tablespoon': 'tablespoon (US)',
  'tablespoons': 'tablespoon (US)',
  'tbsp': 'tablespoon (US)',
  'tbs': 'tablespoon (US)',
  'teaspoon': 'teaspoon (US)',
  'teaspoons': 'teaspoon (US)',
  'tsp': 'teaspoon (US)',
  'fluid ounce': 'fluid ounce (US)',
  'fluid ounces': 'fluid ounce (US)',
  'fl oz': 'fluid ounce (US)',
  'pint': 'pint (US)',
  'pints': 'pint (US)',
  'pt': 'pint (US)',
  'quart': 'quart (US)',
  'quarts': 'quart (US)',
  'qt': 'quart (US)',
  'gallon': 'gallon (US)',
  'gallons': 'gallon (US)',
  'gal': 'gallon (US)',
  
  // Volume - Metric
  'milliliter': 'milliliter',
  'milliliters': 'milliliter',
  'ml': 'milliliter',
  'liter': 'liter',
  'liters': 'liter',
  'l': 'liter',
  
  // Weight
  'gram': 'gram',
  'grams': 'gram',
  'g': 'gram',
  'kilogram': 'kilogram',
  'kilograms': 'kilogram',
  'kg': 'kilogram',
  'ounce': 'ounce',
  'ounces': 'ounce',
  'oz': 'ounce',
  'pound': 'pound',
  'pounds': 'pound',
  'lb': 'pound',
  'lbs': 'pound',
  
  // Count-based (can't convert)
  'piece': 'piece',
  'pieces': 'piece',
  'whole': 'whole',
  'item': 'item',
  'items': 'item',
  'clove': 'clove',
  'cloves': 'clove',
  'head': 'head',
  'heads': 'head',
  'bulb': 'bulb',
  'bulbs': 'bulb',
  'bunch': 'bunch',
  'bunches': 'bunch',
  'stalk': 'stalk',
  'stalks': 'stalk',
  'sprig': 'sprig',
  'sprigs': 'sprig',
  'leaf': 'leaf',
  'leaves': 'leaf',
  'slice': 'slice',
  'slices': 'slice',
  'large': 'large',
  'medium': 'medium',
  'small': 'small'
};

// Preferred units for common ingredients (what's likely on packaging)
const PREFERRED_UNITS: Record<string, string> = {
  // Dry goods - prefer weight
  'flour': 'pound',
  'sugar': 'pound',
  'rice': 'pound',
  'pasta': 'pound',
  'oats': 'pound',
  'quinoa': 'pound',
  'bread': 'ounce',
  'cereal': 'ounce',
  'nuts': 'ounce',
  'seeds': 'ounce',
  'chocolate': 'ounce',
  'cheese': 'ounce',
  'butter': 'pound',
  'oil': 'fluid ounce (US)',
  
  // Liquids - prefer volume
  'milk': 'fluid ounce (US)',
  'cream': 'fluid ounce (US)',
  'broth': 'fluid ounce (US)',
  'stock': 'fluid ounce (US)',
  'juice': 'fluid ounce (US)',
  'wine': 'fluid ounce (US)',
  'vinegar': 'fluid ounce (US)',
  'water': 'fluid ounce (US)',
  
  // Produce - often sold by piece or weight
  'tomato': 'piece',
  'onion': 'piece',
  'potato': 'pound',
  'carrot': 'pound',
  'apple': 'piece',
  'banana': 'piece',
  'lemon': 'piece',
  'lime': 'piece',
  'garlic': 'clove',
  'zucchini': 'piece',
  'summer squash': 'piece',
  
  // Spices/herbs - typically small amounts
  'salt': 'ounce',
  'pepper': 'ounce',
  'basil': 'ounce',
  'oregano': 'ounce',
  'thyme': 'ounce',
  'rosemary': 'ounce',
  'parsley': 'bunch',
  'cilantro': 'bunch'
};

interface ConversionResult {
  success: boolean;
  convertedValue?: number;
  unit?: string;
  error?: string;
}

/**
 * Convert ingredient measurement using the Food Ingredient Conversion API
 */
export async function convertMeasurement(
  ingredient: string,
  fromUnit: string,
  toUnit: string,
  value: number,
  brand?: string
): Promise<ConversionResult> {
  try {
    // Normalize units to API format
    const normalizedFromUnit = UNIT_MAPPINGS[fromUnit.toLowerCase()] || fromUnit;
    const normalizedToUnit = UNIT_MAPPINGS[toUnit.toLowerCase()] || toUnit;
    
    // If units are the same after normalization, no conversion needed
    if (normalizedFromUnit === normalizedToUnit) {
      return { success: true, convertedValue: value, unit: toUnit };
    }
    
    // Check if we can't convert between count-based and measurement units
    const countUnits = ['piece', 'clove', 'head', 'bulb', 'bunch', 'stalk', 'sprig', 'leaf', 'slice', 'large', 'medium', 'small', 'whole', 'item'];
    const isFromCount = countUnits.includes(normalizedFromUnit);
    const isToCount = countUnits.includes(normalizedToUnit);
    
    if (isFromCount || isToCount) {
      return { success: false, error: 'Cannot convert between count-based and measurement units' };
    }
    
    // Build API request
    const params = new URLSearchParams({
      ingredient: ingredient.toLowerCase(),
      from: normalizedFromUnit,
      to: normalizedToUnit,
      value: value.toString(),
      numDigit: '3'
    });
    
    if (brand) {
      params.append('brand', brand);
    }
    
    const url = `https://food-ingredient-measurement-conversion.p.rapidapi.com/convert?${params}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY || '',
        'x-rapidapi-host': 'food-ingredient-measurement-conversion.p.rapidapi.com'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      return { success: false, error: `API request failed: ${response.statusText}` };
    }
    
    const result = await response.text();
    
    // Parse the result (API returns plain text with the converted value)
    const convertedValue = parseFloat(result);
    
    if (isNaN(convertedValue)) {
      return { success: false, error: `Invalid conversion result: ${result}` };
    }
    
    return {
      success: true,
      convertedValue: Math.round(convertedValue * 1000) / 1000, // Round to 3 decimal places
      unit: toUnit
    };
    
  } catch (error) {
    console.error('Measurement conversion error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get the preferred unit for an ingredient (what's likely on packaging)
 */
export function getPreferredUnit(ingredientName: string): string {
  const normalizedName = ingredientName.toLowerCase().trim();
  
  // Check for exact matches first
  if (PREFERRED_UNITS[normalizedName]) {
    return PREFERRED_UNITS[normalizedName];
  }
  
  // Check for partial matches
  for (const [key, unit] of Object.entries(PREFERRED_UNITS)) {
    if (normalizedName.includes(key)) {
      return unit;
    }
  }
  
  // Default fallbacks based on common patterns
  if (normalizedName.includes('oil') || normalizedName.includes('vinegar') || 
      normalizedName.includes('milk') || normalizedName.includes('cream') ||
      normalizedName.includes('juice') || normalizedName.includes('broth') ||
      normalizedName.includes('stock') || normalizedName.includes('water')) {
    return 'fluid ounce (US)';
  }
  
  if (normalizedName.includes('flour') || normalizedName.includes('sugar') ||
      normalizedName.includes('rice') || normalizedName.includes('pasta') ||
      normalizedName.includes('butter')) {
    return 'pound';
  }
  
  // Default to the original unit if we can't determine a preference
  return 'ounce';
}

/**
 * Check if two units can be converted between each other
 */
export function canConvertUnits(unit1: string, unit2: string): boolean {
  const normalizedUnit1 = UNIT_MAPPINGS[unit1.toLowerCase()] || unit1;
  const normalizedUnit2 = UNIT_MAPPINGS[unit2.toLowerCase()] || unit2;
  
  const countUnits = ['piece', 'clove', 'head', 'bulb', 'bunch', 'stalk', 'sprig', 'leaf', 'slice', 'large', 'medium', 'small', 'whole', 'item'];
  const isUnit1Count = countUnits.includes(normalizedUnit1);
  const isUnit2Count = countUnits.includes(normalizedUnit2);
  
  // Can't convert between count and measurement units
  if (isUnit1Count !== isUnit2Count) {
    return false;
  }
  
  // Count units can only be combined if they're the same
  if (isUnit1Count && isUnit2Count) {
    return normalizedUnit1 === normalizedUnit2;
  }
  
  // Measurement units can generally be converted
  return true;
}

/**
 * Normalize a unit string to a standard format
 */
export function normalizeUnit(unit: string): string {
  return UNIT_MAPPINGS[unit.toLowerCase().trim()] || unit.trim();
}