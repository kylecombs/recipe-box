// Server-side nutrition storage utilities
import { db } from "./db.server";
import { analyzeRecipeNutrition, type RecipeNutrition as NutritionAnalysis } from "./nutrition.server";
import type { Ingredient } from "@prisma/client";

/**
 * Store nutrition analysis results in the database
 */
export async function storeRecipeNutrition(
  recipeId: string, 
  nutritionData: NutritionAnalysis
): Promise<void> {
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`💾 Storing nutrition data for recipe ${recipeId} (attempt ${attempt})`);
      
      // First, try to find existing record
      const existing = await db.recipeNutrition.findUnique({
        where: { recipeId },
      });

      const nutritionRecord = {
        recipeId,
        servings: nutritionData.servings,
        // Total nutrition
        totalCalories: nutritionData.totalNutrition.calories,
        totalProtein: nutritionData.totalNutrition.protein,
        totalCarbs: nutritionData.totalNutrition.carbohydrates,
        totalFat: nutritionData.totalNutrition.fat,
        totalFiber: nutritionData.totalNutrition.fiber,
        totalSugar: nutritionData.totalNutrition.sugar,
        totalSodium: nutritionData.totalNutrition.sodium,
        totalCholesterol: nutritionData.totalNutrition.cholesterol,
        totalVitaminC: nutritionData.totalNutrition.vitaminC,
        totalCalcium: nutritionData.totalNutrition.calcium,
        totalIron: nutritionData.totalNutrition.iron,
        // Per serving nutrition
        perServingCalories: nutritionData.perServing.calories,
        perServingProtein: nutritionData.perServing.protein,
        perServingCarbs: nutritionData.perServing.carbohydrates,
        perServingFat: nutritionData.perServing.fat,
        perServingFiber: nutritionData.perServing.fiber,
        perServingSugar: nutritionData.perServing.sugar,
        perServingSodium: nutritionData.perServing.sodium,
        perServingCholesterol: nutritionData.perServing.cholesterol,
        perServingVitaminC: nutritionData.perServing.vitaminC,
        perServingCalcium: nutritionData.perServing.calcium,
        perServingIron: nutritionData.perServing.iron,
        // Calculate average confidence
        confidence: nutritionData.ingredients.reduce((sum, ing) => sum + ing.confidence, 0) / nutritionData.ingredients.length,
      };

      if (existing) {
        // Update existing record
        await db.recipeNutrition.update({
          where: { recipeId },
          data: {
            ...nutritionRecord,
            analyzedAt: new Date(),
          },
        });
      } else {
        // Try to create new record
        try {
          await db.recipeNutrition.create({
            data: nutritionRecord,
          });
        } catch (createError: any) {
          // If create fails due to unique constraint, try to update instead
          if (createError.code === 'P2002') {
            await db.recipeNutrition.update({
              where: { recipeId },
              data: {
                ...nutritionRecord,
                analyzedAt: new Date(),
              },
            });
          } else {
            throw createError;
          }
        }
      }
      
      console.log(`✅ Nutrition data stored successfully for recipe ${recipeId}`);
      return; // Success, exit retry loop
      
    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️ Attempt ${attempt} failed for recipe ${recipeId}:`, error.message);
      
      // If this is a unique constraint error and not the last attempt, retry
      if (error.code === 'P2002' && attempt < maxRetries) {
        // Wait a bit before retrying to avoid rapid-fire conflicts
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        continue;
      }
      
      // If it's not a retryable error or we've exhausted retries, throw
      break;
    }
  }
  
  console.error(`❌ Failed to store nutrition data for recipe ${recipeId} after ${maxRetries} attempts:`, lastError);
  throw lastError || new Error('Unknown error during nutrition storage');
}

/**
 * Retrieve nutrition data from the database
 */
export async function getRecipeNutrition(recipeId: string): Promise<NutritionAnalysis | null> {
  try {
    const nutritionRecord = await db.recipeNutrition.findUnique({
      where: { recipeId },
    });

    if (!nutritionRecord) {
      return null;
    }

    // Convert database record back to NutritionAnalysis format
    const nutritionData: NutritionAnalysis = {
      totalNutrition: {
        calories: nutritionRecord.totalCalories,
        protein: nutritionRecord.totalProtein,
        carbohydrates: nutritionRecord.totalCarbs,
        fat: nutritionRecord.totalFat,
        fiber: nutritionRecord.totalFiber,
        sugar: nutritionRecord.totalSugar,
        sodium: nutritionRecord.totalSodium,
        cholesterol: nutritionRecord.totalCholesterol,
        vitaminC: nutritionRecord.totalVitaminC,
        calcium: nutritionRecord.totalCalcium,
        iron: nutritionRecord.totalIron,
      },
      perServing: {
        calories: nutritionRecord.perServingCalories,
        protein: nutritionRecord.perServingProtein,
        carbohydrates: nutritionRecord.perServingCarbs,
        fat: nutritionRecord.perServingFat,
        fiber: nutritionRecord.perServingFiber,
        sugar: nutritionRecord.perServingSugar,
        sodium: nutritionRecord.perServingSodium,
        cholesterol: nutritionRecord.perServingCholesterol,
        vitaminC: nutritionRecord.perServingVitaminC,
        calcium: nutritionRecord.perServingCalcium,
        iron: nutritionRecord.perServingIron,
      },
      ingredients: [], // We don't store individual ingredient nutrition in DB
      servings: nutritionRecord.servings,
      lastAnalyzed: nutritionRecord.analyzedAt,
    };

    return nutritionData;
  } catch (error) {
    console.error(`❌ Failed to retrieve nutrition data for recipe ${recipeId}:`, error);
    return null;
  }
}

/**
 * Analyze and store nutrition data for a recipe
 */
export async function analyzeAndStoreRecipeNutrition(
  recipeId: string,
  ingredients: Ingredient[],
  servings: number = 1
): Promise<NutritionAnalysis> {
  console.log(`🔬 Starting nutrition analysis for recipe ${recipeId}`);
  
  // Check if we have recent nutrition data (within 30 days)
  const existingNutrition = await getRecipeNutrition(recipeId);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  if (existingNutrition && existingNutrition.lastAnalyzed > thirtyDaysAgo) {
    console.log(`📋 Using cached nutrition data for recipe ${recipeId}`);
    return existingNutrition;
  }

  // Perform fresh analysis
  const nutritionData = await analyzeRecipeNutrition(ingredients, servings);
  
  // Store in database
  await storeRecipeNutrition(recipeId, nutritionData);
  
  return nutritionData;
}

/**
 * Check if nutrition data exists and is recent for a recipe
 */
export async function hasRecentNutritionData(recipeId: string): Promise<boolean> {
  try {
    const nutritionRecord = await db.recipeNutrition.findUnique({
      where: { recipeId },
      select: { analyzedAt: true },
    });

    if (!nutritionRecord) {
      return false;
    }

    // Consider data recent if it's less than 30 days old
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return nutritionRecord.analyzedAt > thirtyDaysAgo;
  } catch (error) {
    console.error(`❌ Failed to check nutrition data for recipe ${recipeId}:`, error);
    return false;
  }
}

/**
 * Delete nutrition data for a recipe (useful when ingredients change significantly)
 */
export async function deleteRecipeNutrition(recipeId: string): Promise<void> {
  try {
    await db.recipeNutrition.delete({
      where: { recipeId },
    });
    console.log(`🗑️ Deleted nutrition data for recipe ${recipeId}`);
  } catch (error) {
    console.error(`❌ Failed to delete nutrition data for recipe ${recipeId}:`, error);
    // Don't throw - it's okay if nutrition data doesn't exist
  }
}