/**
 * Client for the Python ingredient parser service
 */

/**
 * Convert improper fractions back to mixed fractions for better readability
 */
function convertImproperToMixed(quantity: string | null): string | null {
  if (!quantity) return quantity;
  
  // Match improper fractions like "3/2", "5/4", etc.
  const improperFractionMatch = quantity.match(/^(\d+)\/(\d+)$/);
  if (improperFractionMatch) {
    const numerator = parseInt(improperFractionMatch[1]);
    const denominator = parseInt(improperFractionMatch[2]);
    
    // Only convert if numerator > denominator (improper fraction)
    if (numerator > denominator) {
      const wholeNumber = Math.floor(numerator / denominator);
      const remainder = numerator % denominator;
      
      if (remainder === 0) {
        // It's a whole number
        return wholeNumber.toString();
      } else {
        // It's a mixed fraction
        return `${wholeNumber} ${remainder}/${denominator}`;
      }
    }
  }
  
  return quantity;
}

export interface ParsedIngredient {
  name: string;
  quantity: string | null;
  unit: string | null;
  comment: string | null;
  original_text: string;
}

export interface BatchParseResponse {
  ingredients: ParsedIngredient[];
}

const PARSER_SERVICE_URL = process.env.INGREDIENT_PARSER_URL || 'http://localhost:8000';
/**
 * Parse a single ingredient using the Python NLP service
 */
export async function parseIngredient(text: string): Promise<ParsedIngredient> {
  try {
    const response = await fetch(`${PARSER_SERVICE_URL}/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Parser service error: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Convert improper fractions back to mixed fractions
    if (result.quantity) {
      result.quantity = convertImproperToMixed(result.quantity);
    }
    
    return result;
  } catch (error) {
    console.error('Failed to parse ingredient:', error);
    // Fallback to basic parsing
    return {
      name: text,
      quantity: null,
      unit: null,
      comment: null,
      original_text: text,
    };
  }
}

/**
 * Parse multiple ingredients in a single request
 */
export async function parseIngredientsBatch(ingredients: string[]): Promise<ParsedIngredient[]> {
  try {
    const response = await fetch(`${PARSER_SERVICE_URL}/parse-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ingredients }),
    });

    if (!response.ok) {
      throw new Error(`Parser service error: ${response.statusText}`);
    }

    const result: BatchParseResponse = await response.json();
    
    // Convert improper fractions back to mixed fractions for all ingredients
    result.ingredients.forEach(ingredient => {
      if (ingredient.quantity) {
        ingredient.quantity = convertImproperToMixed(ingredient.quantity);
      }
    });
    
    return result.ingredients;
  } catch (error) {
    console.error('Failed to parse ingredients batch:', error);
    // Fallback to basic parsing for all ingredients
    return ingredients.map(text => ({
      name: text,
      quantity: null,
      unit: null,
      comment: null,
      original_text: text,
    }));
  }
}

/**
 * Check if the parser service is healthy
 */
export async function checkParserHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${PARSER_SERVICE_URL}/health`);
    return response.ok;
  } catch (error) {
    console.error('Parser service health check failed:', error);
    return false;
  }
}