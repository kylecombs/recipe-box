import { json, type ActionFunctionArgs } from "@remix-run/node";
import { analyzeAndStoreRecipeNutrition, getRecipeNutrition } from "~/utils/nutrition-storage.server";
import { db } from "~/utils/db.server";

// Track ongoing analysis to prevent concurrent analysis of the same recipe
const ongoingAnalysis = new Set<string>();

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { recipeId } = await request.json();

    if (!recipeId) {
      return json({ error: "Recipe ID is required" }, { status: 400 });
    }

    // Check if analysis is already in progress for this recipe
    if (ongoingAnalysis.has(recipeId)) {
      // Wait a bit and check for cached data in case the other analysis completes
      await new Promise(resolve => setTimeout(resolve, 1000));
      const existingNutrition = await getRecipeNutrition(recipeId);
      if (existingNutrition) {
        return json({ nutrition: existingNutrition });
      }
      return json({ error: "Analysis already in progress" }, { status: 409 });
    }

    // Check if we already have recent nutrition data
    const existingNutrition = await getRecipeNutrition(recipeId);
    if (existingNutrition) {
      return json({ nutrition: existingNutrition });
    }

    // Mark this recipe as being analyzed
    ongoingAnalysis.add(recipeId);

    try {
      // Get recipe with ingredients
      const recipe = await db.recipe.findUnique({
        where: { id: recipeId },
        include: {
          ingredients: true,
        },
      });

      if (!recipe) {
        return json({ error: "Recipe not found" }, { status: 404 });
      }

      if (recipe.ingredients.length === 0) {
        return json({ error: "Recipe has no ingredients" }, { status: 400 });
      }

      // Analyze nutrition asynchronously
      console.log(`🔬 Starting async nutrition analysis for recipe ${recipeId}`);
      const nutrition = await analyzeAndStoreRecipeNutrition(
        recipeId,
        recipe.ingredients,
        recipe.servings || 1
      );

      return json({ nutrition });
      
    } finally {
      // Always remove from ongoing analysis, even if an error occurs
      ongoingAnalysis.delete(recipeId);
    }
    
  } catch (error) {
    console.error("Nutrition analysis API error:", error);
    return json(
      { error: "Failed to analyze nutrition" },
      { status: 500 }
    );
  }
}