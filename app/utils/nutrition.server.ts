// Nutrition analysis service using FoodKG
import type { Ingredient } from "@prisma/client";

export interface NutritionData {
  calories: number;
  protein: number; // grams
  carbohydrates: number; // grams
  fat: number; // grams
  fiber: number; // grams
  sugar: number; // grams
  sodium: number; // mg
  cholesterol: number; // mg
  vitaminC: number; // mg
  calcium: number; // mg
  iron: number; // mg
}

export interface IngredientNutrition {
  ingredient: string;
  quantity: string;
  unit: string;
  nutrition: NutritionData;
  confidence: number; // 0-1 confidence score from FoodKG
}

export interface RecipeNutrition {
  totalNutrition: NutritionData;
  perServing: NutritionData;
  ingredients: IngredientNutrition[];
  servings: number;
  lastAnalyzed: Date;
}

// USDA FoodData Central API configuration (free, reliable alternative to FoodKG)
const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1';
const USDA_API_KEY = process.env.USDA_API_KEY || 'DEMO_KEY'; // Get free key at https://fdc.nal.usda.gov/api-key-signup.html

// Cache for nutrition data to reduce API calls
const nutritionCache = new Map<string, NutritionData>();

/**
 * Clean and normalize ingredient name for FoodKG lookup
 */
function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(fresh|dried|chopped|diced|sliced|minced|grated)\b/g, '')
    .replace(/\b(organic|free-range|grass-fed)\b/g, '')
    .replace(/[,()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Common seasonings and spices with reasonable default amounts (in grams)
const SEASONING_DEFAULTS: Record<string, number> = {
  'salt': 1.5, // ~1/4 tsp
  'pepper': 2, // ~1/2 tsp
  'paprika': 2,
  'cumin': 2,
  'coriander': 2,
  'garlic powder': 3,
  'onion powder': 3,
  'oregano': 1,
  'thyme': 1,
  'basil': 1,
  'rosemary': 1,
  'sage': 1,
  'bay leaves': 0.5,
  'cinnamon': 2,
  'nutmeg': 1,
  'ginger': 2,
  'turmeric': 2,
  'cayenne': 1,
  'chili powder': 2,
  'curry powder': 3,
  'italian seasoning': 2,
  'garlic': 4, // ~1 clove
  'vanilla': 4, // ~1 tsp extract
  'lemon juice': 15, // ~1 tbsp
  'lime juice': 15,
  'vinegar': 15,
  'soy sauce': 15,
  'worcestershire': 5,
  'hot sauce': 5,
  'mustard': 5,
};

/**
 * Check if an ingredient is likely a seasoning/spice
 */
function isSeasoning(ingredient: string): boolean {
  const normalized = ingredient.toLowerCase();
  
  // Direct matches
  if (Object.keys(SEASONING_DEFAULTS).some(seasoning => normalized.includes(seasoning))) {
    return true;
  }
  
  // Pattern matches
  const seasoningPatterns = [
    /\b(salt|pepper|spice|seasoning|powder|extract|sauce|vinegar)\b/,
    /\b(dried|fresh|ground|chopped|minced|crushed)\s+(herbs?|spices?)/,
    /\bto\s+taste\b/,
    /\bpinch\b/,
    /\bdash\b/,
  ];
  
  return seasoningPatterns.some(pattern => pattern.test(normalized));
}

/**
 * Get default amount for seasoning
 */
function getSeasoningDefault(ingredient: string): number {
  const normalized = ingredient.toLowerCase();
  
  for (const [seasoning, defaultGrams] of Object.entries(SEASONING_DEFAULTS)) {
    if (normalized.includes(seasoning)) {
      return defaultGrams;
    }
  }
  
  // Generic seasoning default
  return 2; // ~1/2 tsp
}

/**
 * Convert quantity and unit to grams for nutrition calculation
 */
function convertToGrams(quantity: string, unit: string, ingredient: string): number {
  console.log(`🔢 convertToGrams DEBUG - Input:`, { quantity, unit, ingredient });
  console.log(`🔢 quantity type: ${typeof quantity}, value: "${quantity}"`);
  console.log(`🔢 quantity.trim(): "${quantity?.trim?.() || 'NO_TRIM_METHOD'}"`);
  
  // Common conversion factors (approximate)
  const conversions: Record<string, number> = {
    // Volume to weight conversions (approximate, ingredient-dependent)
    'cup': 240, // ml, then estimate density
    'cups': 240,
    'tablespoon': 15,
    'tablespoons': 15,
    'tbsp': 15,
    'teaspoon': 5,
    'teaspoons': 5,
    'tsp': 5,
    'fluid ounce': 30,
    'fl oz': 30,
    'ounce': 28.35, // weight
    'ounces': 28.35,
    'oz': 28.35,
    'pound': 453.59,
    'pounds': 453.59,
    'lb': 453.59,
    'lbs': 453.59,
    'gram': 1,
    'grams': 1,
    'g': 1,
    'kilogram': 1000,
    'kilograms': 1000,
    'kg': 1000,
    'liter': 1000, // assuming water density
    'liters': 1000,
    'l': 1000,
    'milliliter': 1,
    'milliliters': 1,
    'ml': 1,
  };

  const numQuantity = parseFloat(quantity) || 0;
  const normalizedUnit = unit.toLowerCase().trim();

  // Handle case where no quantity is specified or vague quantities
  if (!quantity || quantity.trim() === '' || numQuantity === 0) {
    if (isSeasoning(ingredient)) {
      const defaultAmount = getSeasoningDefault(ingredient);
      console.log(`🧂 Using seasoning default for "${ingredient}": ${defaultAmount}g`);
      return defaultAmount;
    }
    // For non-seasonings without quantity, use a more reasonable default than 100g
    console.log(`📦 Using generic default for "${ingredient}": 50g`);
    return 50; // 50g instead of 100g default
  }

  // Handle vague seasoning quantities
  const quantityLower = quantity.toLowerCase().trim();
  if (isSeasoning(ingredient)) {
    if (quantityLower.includes('to taste') || 
        quantityLower.includes('pinch') || 
        quantityLower.includes('dash') ||
        quantityLower.includes('sprinkle')) {
      console.log(`🧂 Using seasoning default for vague quantity "${quantity}" of "${ingredient}": ${getSeasoningDefault(ingredient)}g`);
      return getSeasoningDefault(ingredient);
    }
  }

  // Direct weight conversions
  if (conversions[normalizedUnit]) {
    return numQuantity * conversions[normalizedUnit];
  }

  // Special cases for common ingredients
  const ingredientLower = ingredient.toLowerCase();
  
  // Density-based conversions for common ingredients
  if (normalizedUnit.includes('cup')) {
    if (ingredientLower.includes('flour')) return numQuantity * 120;
    if (ingredientLower.includes('sugar')) return numQuantity * 200;
    if (ingredientLower.includes('rice')) return numQuantity * 185;
    if (ingredientLower.includes('oil')) return numQuantity * 220;
    if (ingredientLower.includes('water')) return numQuantity * 240;
    if (ingredientLower.includes('milk')) return numQuantity * 245;
    return numQuantity * 240; // default liquid density
  }

  // Count-based items (estimate)
  if (normalizedUnit === 'large' || normalizedUnit === 'medium' || normalizedUnit === 'small') {
    if (ingredientLower.includes('egg')) return numQuantity * 50;
    if (ingredientLower.includes('onion')) return numQuantity * 150;
    if (ingredientLower.includes('apple')) return numQuantity * 180;
    return numQuantity * 100; // default estimate
  }

  // Default fallback
  return numQuantity * 100;
}

/**
 * Query USDA FoodData Central API for ingredient nutrition data
 */
async function queryUSDAFood(ingredient: string): Promise<NutritionData | null> {
  const cacheKey = normalizeIngredientName(ingredient);
  
  // Check cache first
  if (nutritionCache.has(cacheKey)) {
    return nutritionCache.get(cacheKey)!;
  }

  try {
    // Search for foods matching the ingredient name
    const searchResponse = await fetch(
      `${USDA_API_BASE}/foods/search?query=${encodeURIComponent(cacheKey)}&pageSize=1&api_key=${USDA_API_KEY}`
    );

    if (!searchResponse.ok) {
      console.warn(`USDA API search error for "${ingredient}":`, searchResponse.statusText);
      return null;
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.foods || searchData.foods.length === 0) {
      return null;
    }

    const food = searchData.foods[0];
    
    // Get detailed nutrition data
    const detailResponse = await fetch(
      `${USDA_API_BASE}/food/${food.fdcId}?api_key=${USDA_API_KEY}`
    );

    if (!detailResponse.ok) {
      console.warn(`USDA API detail error for "${ingredient}":`, detailResponse.statusText);
      return null;
    }

    const detailData = await detailResponse.json();
    
    // Map USDA nutrient IDs to our nutrition data structure
    const nutrientMap: Record<number, keyof NutritionData> = {
      1008: 'calories',    // Energy
      1003: 'protein',     // Protein
      1005: 'carbohydrates', // Carbohydrate, by difference
      1004: 'fat',         // Total lipid (fat)
      1079: 'fiber',       // Fiber, total dietary
      2000: 'sugar',       // Total sugars
      1093: 'sodium',      // Sodium, Na
      1253: 'cholesterol', // Cholesterol
      1162: 'vitaminC',    // Vitamin C, total ascorbic acid
      1087: 'calcium',     // Calcium, Ca
      1089: 'iron',        // Iron, Fe
    };

    const nutrition: NutritionData = {
      calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0, sugar: 0,
      sodium: 0, cholesterol: 0, vitaminC: 0, calcium: 0, iron: 0
    };

    // Extract nutrition values from USDA data
    if (detailData.foodNutrients) {
      for (const nutrient of detailData.foodNutrients) {
        const nutritionKey = nutrientMap[nutrient.nutrient.id];
        if (nutritionKey && nutrient.amount) {
          nutrition[nutritionKey] = nutrient.amount;
        }
      }
    }

    // Cache the result
    nutritionCache.set(cacheKey, nutrition);
    return nutrition;
    
  } catch (error) {
    console.error(`Error querying USDA API for "${ingredient}":`, error);
    return null;
  }
}

/**
 * Fallback nutrition database for common ingredients
 */
const fallbackNutrition: Record<string, NutritionData> = {
  'flour': { calories: 364, protein: 10.3, carbohydrates: 76.3, fat: 1.0, fiber: 2.7, sugar: 0.3, sodium: 2, cholesterol: 0, vitaminC: 0, calcium: 15, iron: 1.2 },
  'sugar': { calories: 387, protein: 0, carbohydrates: 100, fat: 0, fiber: 0, sugar: 100, sodium: 0, cholesterol: 0, vitaminC: 0, calcium: 0, iron: 0 },
  'butter': { calories: 717, protein: 0.9, carbohydrates: 0.1, fat: 81.1, fiber: 0, sugar: 0.1, sodium: 11, cholesterol: 215, vitaminC: 0, calcium: 24, iron: 0 },
  'egg': { calories: 155, protein: 13.0, carbohydrates: 1.1, fat: 11.0, fiber: 0, sugar: 1.1, sodium: 124, cholesterol: 373, vitaminC: 0, calcium: 50, iron: 1.8 },
  'milk': { calories: 42, protein: 3.4, carbohydrates: 5.0, fat: 1.0, fiber: 0, sugar: 5.0, sodium: 44, cholesterol: 5, vitaminC: 0, calcium: 113, iron: 0 },
  'oil': { calories: 884, protein: 0, carbohydrates: 0, fat: 100, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0, vitaminC: 0, calcium: 0, iron: 0 },
  'salt': { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0, sugar: 0, sodium: 38758, cholesterol: 0, vitaminC: 0, calcium: 24, iron: 0.3 },
  'water': { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0, vitaminC: 0, calcium: 0, iron: 0 },
  // Common seasonings and spices (per 100g, but will be scaled down by our defaults)
  'pepper': { calories: 251, protein: 10.4, carbohydrates: 64.8, fat: 3.3, fiber: 25.3, sugar: 0.6, sodium: 20, cholesterol: 0, vitaminC: 0, calcium: 443, iron: 9.7 },
  'paprika': { calories: 282, protein: 14.1, carbohydrates: 53.9, fat: 12.9, fiber: 34.9, sugar: 10.3, sodium: 68, cholesterol: 0, vitaminC: 0, calcium: 229, iron: 21.1 },
  'cumin': { calories: 375, protein: 17.8, carbohydrates: 44.2, fat: 22.3, fiber: 10.5, sugar: 2.2, sodium: 168, cholesterol: 0, vitaminC: 7.7, calcium: 931, iron: 66.4 },
  'coriander': { calories: 298, protein: 12.4, carbohydrates: 54.9, fat: 17.8, fiber: 41.9, sugar: 0, sodium: 35, cholesterol: 0, vitaminC: 21, calcium: 709, iron: 16.3 },
  'garlic': { calories: 149, protein: 6.4, carbohydrates: 33.1, fat: 0.5, fiber: 2.1, sugar: 1.0, sodium: 17, cholesterol: 0, vitaminC: 31.2, calcium: 181, iron: 1.7 },
  'vinegar': { calories: 18, protein: 0, carbohydrates: 0.04, fat: 0, fiber: 0, sugar: 0.04, sodium: 5, cholesterol: 0, vitaminC: 0, calcium: 6, iron: 0.2 },
};

/**
 * Get nutrition data for a single ingredient
 */
async function getIngredientNutrition(ingredient: Ingredient): Promise<IngredientNutrition | null> {
  const normalizedName = normalizeIngredientName(ingredient.name);
  const grams = convertToGrams(ingredient.quantity || '', ingredient.unit || '', ingredient.name);
  
  console.log(`🔍 DEBUG - Ingredient: "${ingredient.name}"`);
  console.log(`🔍 DEBUG - Quantity: "${ingredient.quantity || 'NONE'}"`);
  console.log(`🔍 DEBUG - Unit: "${ingredient.unit || 'NONE'}"`);
  console.log(`🔍 DEBUG - Normalized: "${normalizedName}"`);
  console.log(`🔍 DEBUG - Grams calculated: ${grams}g`);
  console.log(`🔍 DEBUG - Is seasoning? ${isSeasoning(ingredient.name)}`);
  
  // Try USDA API first
  let nutritionPer100g = await queryUSDAFood(normalizedName);
  let confidence = 0.9;

  // Fallback to local database
  if (!nutritionPer100g) {
    for (const [key, nutrition] of Object.entries(fallbackNutrition)) {
      if (normalizedName.includes(key)) {
        console.log(`🔍 DEBUG - Using fallback nutrition for "${key}"`);
        console.log(`🔍 DEBUG - Fallback sodium per 100g: ${nutrition.sodium}mg`);
        nutritionPer100g = nutrition;
        confidence = 0.7;
        break;
      }
    }
  }

  // Final fallback with very low confidence
  if (!nutritionPer100g) {
    nutritionPer100g = {
      calories: 100, protein: 5, carbohydrates: 15, fat: 2, fiber: 2, sugar: 5,
      sodium: 100, cholesterol: 0, vitaminC: 5, calcium: 50, iron: 1
    };
    confidence = 0.3;
  }

  // Scale nutrition data based on actual ingredient amount
  const scaleFactor = grams / 100; // nutrition data is typically per 100g
  console.log(`🔍 DEBUG - Scale factor: ${scaleFactor} (${grams}g / 100g)`);
  console.log(`🔍 DEBUG - Sodium before scaling: ${nutritionPer100g.sodium}mg per 100g`);
  
  const scaledNutrition: NutritionData = {
    calories: nutritionPer100g.calories * scaleFactor,
    protein: nutritionPer100g.protein * scaleFactor,
    carbohydrates: nutritionPer100g.carbohydrates * scaleFactor,
    fat: nutritionPer100g.fat * scaleFactor,
    fiber: nutritionPer100g.fiber * scaleFactor,
    sugar: nutritionPer100g.sugar * scaleFactor,
    sodium: nutritionPer100g.sodium * scaleFactor,
    cholesterol: nutritionPer100g.cholesterol * scaleFactor,
    vitaminC: nutritionPer100g.vitaminC * scaleFactor,
    calcium: nutritionPer100g.calcium * scaleFactor,
    iron: nutritionPer100g.iron * scaleFactor,
  };
  
  console.log(`🔍 DEBUG - Sodium after scaling: ${scaledNutrition.sodium}mg`);
  console.log(`🔍 DEBUG - Final ingredient nutrition:`, {
    ingredient: ingredient.name,
    grams,
    sodium: scaledNutrition.sodium,
    confidence
  });
  console.log('=====================================');

  return {
    ingredient: ingredient.name,
    quantity: ingredient.quantity || '',
    unit: ingredient.unit || '',
    nutrition: scaledNutrition,
    confidence
  };
}

/**
 * Analyze nutrition for an entire recipe
 */
export async function analyzeRecipeNutrition(
  ingredients: Ingredient[], 
  servings: number = 1
): Promise<RecipeNutrition> {
  console.log(`🥗 Analyzing nutrition for ${ingredients.length} ingredients, ${servings} servings`);
  
  const ingredientNutritions: IngredientNutrition[] = [];
  const totalNutrition: NutritionData = {
    calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0, sugar: 0,
    sodium: 0, cholesterol: 0, vitaminC: 0, calcium: 0, iron: 0
  };

  // Analyze each ingredient
  for (const ingredient of ingredients) {
    const ingredientNutrition = await getIngredientNutrition(ingredient);
    
    if (ingredientNutrition) {
      ingredientNutritions.push(ingredientNutrition);
      
      // Add to totals
      totalNutrition.calories += ingredientNutrition.nutrition.calories;
      totalNutrition.protein += ingredientNutrition.nutrition.protein;
      totalNutrition.carbohydrates += ingredientNutrition.nutrition.carbohydrates;
      totalNutrition.fat += ingredientNutrition.nutrition.fat;
      totalNutrition.fiber += ingredientNutrition.nutrition.fiber;
      totalNutrition.sugar += ingredientNutrition.nutrition.sugar;
      totalNutrition.sodium += ingredientNutrition.nutrition.sodium;
      totalNutrition.cholesterol += ingredientNutrition.nutrition.cholesterol;
      totalNutrition.vitaminC += ingredientNutrition.nutrition.vitaminC;
      totalNutrition.calcium += ingredientNutrition.nutrition.calcium;
      totalNutrition.iron += ingredientNutrition.nutrition.iron;
    }
  }

  // Calculate per-serving nutrition
  const perServing: NutritionData = {
    calories: Math.round(totalNutrition.calories / servings),
    protein: Math.round(totalNutrition.protein / servings * 10) / 10,
    carbohydrates: Math.round(totalNutrition.carbohydrates / servings * 10) / 10,
    fat: Math.round(totalNutrition.fat / servings * 10) / 10,
    fiber: Math.round(totalNutrition.fiber / servings * 10) / 10,
    sugar: Math.round(totalNutrition.sugar / servings * 10) / 10,
    sodium: Math.round(totalNutrition.sodium / servings),
    cholesterol: Math.round(totalNutrition.cholesterol / servings),
    vitaminC: Math.round(totalNutrition.vitaminC / servings * 10) / 10,
    calcium: Math.round(totalNutrition.calcium / servings),
    iron: Math.round(totalNutrition.iron / servings * 10) / 10,
  };

  console.log(`✅ Nutrition analysis complete - ${totalNutrition.calories} total calories, ${perServing.calories} per serving`);

  return {
    totalNutrition,
    perServing,
    ingredients: ingredientNutritions,
    servings,
    lastAnalyzed: new Date()
  };
}

/**
 * Format nutrition value for display
 */
export function formatNutritionValue(value: number, unit: string): string {
  if (value < 0.1) return '0' + unit;
  if (value < 1) return value.toFixed(1) + unit;
  if (value < 10) return value.toFixed(1) + unit;
  return Math.round(value) + unit;
}