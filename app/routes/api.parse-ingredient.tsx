import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { parseIngredient } from "~/utils/ingredient-parser.server";
import { normalizeIngredientName } from "~/utils/ingredient-matcher.server";

// Common ingredient mappings to API-friendly names
const INGREDIENT_MAPPINGS: Record<string, string> = {
  'chicken breast': 'chicken',
  'chicken breasts': 'chicken',
  'skinless chicken breast': 'chicken',
  'boneless chicken breast': 'chicken',
  'skinless boneless chicken breast': 'chicken',
  'skinless, boneless chicken breasts': 'chicken',
  'ground beef': 'beef',
  'lean ground beef': 'beef',
  'all-purpose flour': 'flour',
  'all purpose flour': 'flour',
  'granulated sugar': 'sugar',
  'white sugar': 'sugar',
  'unsalted butter': 'butter',
  'salted butter': 'butter',
  'whole milk': 'milk',
  'skim milk': 'milk',
  '2% milk': 'milk',
  'extra virgin olive oil': 'olive oil',
  'extra-virgin olive oil': 'olive oil',
  'kosher salt': 'salt',
  'sea salt': 'salt',
  'table salt': 'salt',
  'freshly ground black pepper': 'black pepper',
  'ground black pepper': 'black pepper'
};

function mapIngredientName(name: string): string {
  const lowerName = name.toLowerCase().trim();
  return INGREDIENT_MAPPINGS[lowerName] || name;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { text } = await request.json();
    
    if (!text) {
      return json({ 
        success: false, 
        error: "Missing required field: text" 
      }, { status: 400 });
    }

    const result = await parseIngredient(text);
    
    // If the parser returned a name, normalize and map it
    if (result.name) {
      // If the result name is the same as the original text, it means parsing failed
      // Extract just the ingredient name from the original text
      if (result.name === text) {
        // Try to extract just the ingredient name by removing quantity and unit
        const parts = text.split(' ');
        let ingredientName = text;
        
        // Simple heuristic: skip first 1-2 words if they look like quantity/unit
        if (parts.length >= 3) {
          // Check if first word is a number/fraction
          const firstWord = parts[0];
          if (firstWord.match(/^\d+(\.\d+)?$/) || firstWord.match(/^\d+\/\d+$/) || firstWord.match(/^\d+\s+\d+\/\d+$/)) {
            // Skip quantity and unit
            ingredientName = parts.slice(2).join(' ');
          }
        }
        
        result.name = ingredientName;
      }
      
      // First normalize to remove preparation terms
      const normalized = normalizeIngredientName(result.name);
      // Then map to API-friendly name
      result.name = mapIngredientName(normalized);
    }
    
    return json(result);
  } catch (error) {
    console.error("Parse ingredient API error:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Parsing failed" 
    }, { status: 500 });
  }
};

// Don't allow GET requests to this endpoint
export const loader = () => {
  return json({ error: "Method not allowed" }, { status: 405 });
};