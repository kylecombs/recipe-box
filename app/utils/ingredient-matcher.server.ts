/**
 * Utility functions for intelligent ingredient matching and normalization
 */

// Common preparation terms to remove from ingredient names
const PREPARATION_TERMS = [
  // Cutting/slicing
  'sliced', 'diced', 'chopped', 'minced', 'grated', 'shredded', 'julienned',
  'cut', 'pieces', 'chunks', 'cubes', 'strips', 'rounds', 'wedges',
  'halved', 'quartered', 'sectioned', 'trimmed', 'peeled', 'cored',
  
  // Thickness/size descriptions
  'thin', 'thick', 'fine', 'coarse', 'small', 'medium', 'large', 'extra large',
  'bite-sized', 'inch-thick', 'inch thick', '1/4-inch', '1/2-inch', '3/4-inch',
  '1-inch', '2-inch', 'thinly', 'thickly', 'finely', 'roughly', 'coarsely',
  
  // Cooking states
  'fresh', 'frozen', 'thawed', 'defrosted', 'room temperature', 'cold',
  'softened', 'melted', 'warmed', 'cooled', 'chilled',
  
  // Processing
  'washed', 'rinsed', 'dried', 'patted dry', 'drained', 'squeezed',
  'stemmed', 'deseeded', 'pitted', 'hulled', 'cleaned',
  
  // Common modifiers
  'optional', 'or more', 'or less', 'about', 'approximately', 'roughly',
  'plus more', 'extra', 'additional', 'divided', 'separated',
  
  // Brands/types that should be ignored for matching
  'brand', 'type', 'variety', 'any brand', 'your favorite'
];

// Common ingredient synonyms
const INGREDIENT_SYNONYMS: Record<string, string[]> = {
  'zucchini': ['courgette'],
  'bell pepper': ['sweet pepper', 'capsicum'],
  'green onion': ['scallion', 'spring onion'],
  'cilantro': ['fresh coriander', 'coriander leaves'],
  'parsley': ['fresh parsley', 'flat-leaf parsley', 'italian parsley'],
  'tomato': ['fresh tomato', 'ripe tomato'],
  'onion': ['yellow onion', 'white onion', 'sweet onion'],
  'garlic': ['fresh garlic', 'garlic clove', 'garlic cloves'],
  'lemon': ['fresh lemon'],
  'lime': ['fresh lime'],
  'butter': ['unsalted butter', 'salted butter'],
  'olive oil': ['extra virgin olive oil', 'extra-virgin olive oil'],
  'black pepper': ['freshly ground black pepper', 'ground black pepper'],
  'salt': ['sea salt', 'kosher salt', 'table salt'],
  'cheese': ['shredded cheese', 'grated cheese'],
  'chicken': ['chicken breast', 'chicken thigh', 'boneless chicken'],
  'beef': ['ground beef', 'beef chuck', 'beef sirloin'],
  'flour': ['all-purpose flour', 'plain flour'],
  'sugar': ['granulated sugar', 'white sugar'],
  'milk': ['whole milk', '2% milk', 'skim milk'],
  'egg': ['large egg', 'medium egg', 'chicken egg']
};

// Special formatting rules for ingredients with units that should come before the ingredient name
const UNIT_FIRST_INGREDIENTS: Record<string, string> = {
  'garlic': 'cloves',
  'egg': 'large',
  'lemon': 'large',
  'lime': 'large',
  'onion': 'large',
  'potato': 'large',
  'tomato': 'large',
  'apple': 'large',
  'orange': 'large'
};

/**
 * Normalize an ingredient name by removing preparation terms and parenthetical notes
 */
export function normalizeIngredientName(name: string): string {
  let normalized = name.toLowerCase().trim();
  
  // Remove content in parentheses (preparation notes, weights, etc.)
  normalized = normalized.replace(/\([^)]*\)/g, '');
  
  // Remove content in brackets
  normalized = normalized.replace(/\[[^\]]*\]/g, '');
  
  // Remove common preparation terms, but be careful with compound words
  const preparationPattern = new RegExp(
    `\\b(${PREPARATION_TERMS.join('|')})\\b`, 'gi'
  );
  
  // Don't remove "extra" if it's part of "extra-virgin" or "extra virgin"
  if (normalized.includes('extra-virgin') || normalized.includes('extra virgin')) {
    // Remove all preparation terms except "extra"
    const filteredTerms = PREPARATION_TERMS.filter(term => term !== 'extra');
    const filteredPattern = new RegExp(
      `\\b(${filteredTerms.join('|')})\\b`, 'gi'
    );
    normalized = normalized.replace(filteredPattern, '');
  } else {
    normalized = normalized.replace(preparationPattern, '');
  }
  
  // Remove multiple spaces and trim
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Remove trailing commas and prepositions
  normalized = normalized.replace(/[,;]\s*$/, '');
  normalized = normalized.replace(/\s+(for|into|in|to|with|before|after)\s+.*$/, '');
  
  // Handle "or" alternatives - but preserve mixtures
  // Only split on "or" if it's clearly listing alternatives, not mixtures
  if (normalized.includes(' or ') && !normalized.includes('mixture')) {
    // Check if it's a list of alternatives (e.g. "zucchini or summer squash")
    // vs a mixture description (e.g. "parmesan, pecorino or a mixture")
    const orParts = normalized.split(' or ');
    // If the second part is very short (1-2 words), it's likely "or a mixture" and should be kept
    if (orParts[1] && orParts[1].trim().split(' ').length > 2) {
      normalized = orParts[0].trim();
    }
  }
  
  // Final cleanup of stray commas and whitespace
  normalized = normalized.replace(/,\s*$/, ''); // Remove trailing commas
  normalized = normalized.replace(/^\s*,/, ''); // Remove leading commas
  normalized = normalized.replace(/,\s*,/g, ','); // Fix double commas
  normalized = normalized.replace(/\s*,\s*$/, ''); // Remove trailing comma with spaces
  normalized = normalized.trim();
  
  return normalized;
}

/**
 * Get the canonical name for an ingredient, considering synonyms
 */
export function getCanonicalIngredientName(name: string): string {
  const normalized = normalizeIngredientName(name);
  
  // Check if this matches any synonyms
  for (const [canonical, synonyms] of Object.entries(INGREDIENT_SYNONYMS)) {
    if (canonical === normalized || synonyms.includes(normalized)) {
      return canonical;
    }
  }
  
  return normalized;
}

/**
 * Check if two ingredient names refer to the same ingredient
 */
export function areIngredientsEqual(name1: string, name2: string): boolean {
  const canonical1 = getCanonicalIngredientName(name1);
  const canonical2 = getCanonicalIngredientName(name2);
  
  // Direct match
  if (canonical1 === canonical2) {
    return true;
  }
  
  // Fuzzy match - check if one contains the other (for partial matches)
  const longer = canonical1.length > canonical2.length ? canonical1 : canonical2;
  const shorter = canonical1.length > canonical2.length ? canonical2 : canonical1;
  
  // Only consider it a match if the shorter string is substantial (>= 3 chars)
  // and makes up a significant portion of the longer string
  if (shorter.length >= 3 && longer.includes(shorter) && 
      shorter.length / longer.length >= 0.5) {
    return true;
  }
  
  return false;
}

/**
 * Extract weight information from parenthetical descriptions
 */
function extractWeightFromDescription(name: string, quantity: string | null): { weight: number | null; unit: string | null } {
  // Look for patterns like "(about 8 ounces each)", "(8 oz each)", "(1 pound each)", etc.
  const weightPattern = /\((?:about\s+)?(\d+(?:\.\d+)?)\s*(ounces?|oz|pounds?|lbs?|grams?|g|kg|kilograms?)\s+each\)/i;
  const match = name.match(weightPattern);
  
  if (match && quantity) {
    const weightPerItem = parseFloat(match[1]);
    const weightUnit = match[2].toLowerCase();
    const itemCount = parseFloat(quantity);
    
    if (!isNaN(weightPerItem) && !isNaN(itemCount)) {
      const totalWeight = weightPerItem * itemCount;
      
      // Normalize unit names
      const normalizedUnit = weightUnit.includes('pound') || weightUnit.includes('lb') ? 'pounds' : 'ounces';
      
      return {
        weight: totalWeight,
        unit: normalizedUnit
      };
    }
  }
  
  return { weight: null, unit: null };
}

/**
 * Combine quantities when possible
 */
export function combineQuantities(
  quantity1: string | null, 
  unit1: string | null,
  quantity2: string | null, 
  unit2: string | null,
  name1?: string,
  name2?: string
): { quantity: string | null; unit: string | null } {
  // If either quantity is missing, use the one that exists
  if (!quantity1) return { quantity: quantity2, unit: unit2 };
  if (!quantity2) return { quantity: quantity1, unit: unit1 };
  
  // Try to extract weight information from names if provided
  const weight1 = name1 ? extractWeightFromDescription(name1, quantity1) : { weight: null, unit: null };
  const weight2 = name2 ? extractWeightFromDescription(name2, quantity2) : { weight: null, unit: null };
  
  // If we can extract weights from both, use those for conversion
  if (weight1.weight !== null && weight1.unit && weight2.weight !== null && weight2.unit) {
    // Convert to common unit (ounces for smaller amounts, pounds for larger)
    const totalOunces1 = weight1.unit === 'pounds' ? weight1.weight * 16 : weight1.weight;
    const totalOunces2 = weight2.unit === 'pounds' ? weight2.weight * 16 : weight2.weight;
    const combinedOunces = totalOunces1 + totalOunces2;
    
    // Use pounds if >= 16 ounces, otherwise ounces
    if (combinedOunces >= 16) {
      const pounds = combinedOunces / 16;
      return {
        quantity: pounds % 1 === 0 ? pounds.toString() : pounds.toFixed(2),
        unit: 'pounds'
      };
    } else {
      return {
        quantity: combinedOunces % 1 === 0 ? combinedOunces.toString() : combinedOunces.toFixed(2),
        unit: 'ounces'
      };
    }
  }
  
  // If one has extractable weight and the other is already a weight unit, combine them
  if (weight1.weight !== null && weight1.unit && unit2 && (unit2.toLowerCase().includes('pound') || unit2.toLowerCase().includes('ounce'))) {
    const qty2 = parseFloat(quantity2);
    if (!isNaN(qty2)) {
      const totalOunces1 = weight1.unit === 'pounds' ? weight1.weight * 16 : weight1.weight;
      const totalOunces2 = unit2.toLowerCase().includes('pound') ? qty2 * 16 : qty2;
      const combinedOunces = totalOunces1 + totalOunces2;
      
      if (combinedOunces >= 16) {
        const pounds = combinedOunces / 16;
        return {
          quantity: pounds % 1 === 0 ? pounds.toString() : pounds.toFixed(2),
          unit: 'pounds'
        };
      } else {
        return {
          quantity: combinedOunces % 1 === 0 ? combinedOunces.toString() : combinedOunces.toFixed(2),
          unit: 'ounces'
        };
      }
    }
  }
  
  if (weight2.weight !== null && weight2.unit && unit1 && (unit1.toLowerCase().includes('pound') || unit1.toLowerCase().includes('ounce'))) {
    const qty1 = parseFloat(quantity1);
    if (!isNaN(qty1)) {
      const totalOunces1 = unit1.toLowerCase().includes('pound') ? qty1 * 16 : qty1;
      const totalOunces2 = weight2.unit === 'pounds' ? weight2.weight * 16 : weight2.weight;
      const combinedOunces = totalOunces1 + totalOunces2;
      
      if (combinedOunces >= 16) {
        const pounds = combinedOunces / 16;
        return {
          quantity: pounds % 1 === 0 ? pounds.toString() : pounds.toFixed(2),
          unit: 'pounds'
        };
      } else {
        return {
          quantity: combinedOunces % 1 === 0 ? combinedOunces.toString() : combinedOunces.toFixed(2),
          unit: 'ounces'
        };
      }
    }
  }
  
  // Handle count-based ingredients better
  const countUnits = ['piece', 'pieces', 'clove', 'cloves', 'head', 'heads', 'bulb', 'bulbs', 'bunch', 'bunches', 'stalk', 'stalks', 'sprig', 'sprigs', 'leaf', 'leaves', 'slice', 'slices', 'large', 'medium', 'small', 'whole', 'item', 'items'];
  const isUnit1Count = unit1 ? countUnits.includes(unit1.toLowerCase()) : false;
  const isUnit2Count = unit2 ? countUnits.includes(unit2.toLowerCase()) : false;
  
  // Special handling for count-based ingredients
  if ((isUnit1Count || !unit1) && (isUnit2Count || !unit2)) {
    // Both are count-based or one has no unit (assume count)
    const num1 = parseFloat(quantity1);
    const num2 = parseFloat(quantity2);
    
    if (!isNaN(num1) && !isNaN(num2)) {
      const total = num1 + num2;
      // Use the more descriptive unit if available, otherwise default to pieces
      const resultUnit = (unit1 && unit1 !== 'piece' && unit1 !== 'pieces') ? unit1 : 
                        (unit2 && unit2 !== 'piece' && unit2 !== 'pieces') ? unit2 : 
                        null;
      return { 
        quantity: total % 1 === 0 ? total.toString() : total.toFixed(2),
        unit: resultUnit
      };
    }
  }
  
  // If units are different or missing, concatenate
  if (!unit1 || !unit2 || unit1.toLowerCase() !== unit2.toLowerCase()) {
    const combined = `${quantity1}${unit1 ? ` ${unit1}` : ''} + ${quantity2}${unit2 ? ` ${unit2}` : ''}`;
    return { 
      quantity: combined.length > 150 ? combined.substring(0, 150) + '...' : combined,
      unit: null
    };
  }
  
  // Try to add numeric quantities
  const num1 = parseFloat(quantity1);
  const num2 = parseFloat(quantity2);
  
  if (!isNaN(num1) && !isNaN(num2)) {
    // Handle fractions and mixed numbers
    const total = num1 + num2;
    return { 
      quantity: total % 1 === 0 ? total.toString() : total.toFixed(2),
      unit: unit1
    };
  }
  
  // Handle common fractions
  const fractionMap: Record<string, number> = {
    '1/4': 0.25, '1/3': 0.33, '1/2': 0.5, '2/3': 0.67, '3/4': 0.75,
    '1¼': 1.25, '1½': 1.5, '1¾': 1.75, '2¼': 2.25, '2½': 2.5, '2¾': 2.75
  };
  
  const frac1 = fractionMap[quantity1.trim()];
  const frac2 = fractionMap[quantity2.trim()];
  
  if (frac1 !== undefined && frac2 !== undefined) {
    const total = frac1 + frac2;
    return { 
      quantity: total % 1 === 0 ? total.toString() : total.toFixed(2),
      unit: unit1
    };
  }
  
  // If we can't combine numerically, concatenate
  const combined = `${quantity1} + ${quantity2}`;
  return { 
    quantity: combined.length > 150 ? combined.substring(0, 150) + '...' : combined,
    unit: unit1
  };
}

/**
 * Format ingredient display name with proper quantity and unit positioning
 */
export function formatIngredientForDisplay(
  name: string,
  quantity: string | null,
  unit: string | null
): { displayName: string; displayQuantity: string | null; displayUnit: string | null } {
  const canonicalName = getCanonicalIngredientName(name);
  
  // Check if this ingredient should have its unit displayed before the name
  const preferredUnit = UNIT_FIRST_INGREDIENTS[canonicalName];
  
  // Handle garlic cloves specifically
  if (canonicalName === 'garlic' && unit && unit.toLowerCase().includes('clove')) {
    return {
      displayName: 'garlic',
      displayQuantity: quantity,
      displayUnit: quantity && parseInt(quantity) === 1 ? 'clove' : 'cloves'
    };
  }
  
  // Handle other unit-first ingredients
  if (preferredUnit && unit && unit.toLowerCase().includes(preferredUnit)) {
    return {
      displayName: canonicalName,
      displayQuantity: quantity,
      displayUnit: unit
    };
  }
  
  return {
    displayName: canonicalName || name,
    displayQuantity: quantity,
    displayUnit: unit
  };
}

/**
 * Clean up extra spaces and commas from text
 */
export function cleanText(text: string): string {
  return text
    .replace(/\s*,\s*,\s*/g, ', ') // Fix double commas
    .replace(/,\s*$/, '') // Remove trailing comma
    .replace(/^\s*,\s*/, '') // Remove leading comma
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Find matching ingredient in a list
 */
export function findMatchingIngredient<T extends { name: string }>(
  targetName: string,
  ingredients: T[]
): T | undefined {
  return ingredients.find(ingredient => 
    areIngredientsEqual(targetName, ingredient.name)
  );
}