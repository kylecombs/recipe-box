import { json, type ActionFunctionArgs } from "@remix-run/node";
import { requireUserId } from "~/utils/auth.server";
import { db } from "~/utils/db.server";

const MEAL_PLANNER_SERVICE_URL = process.env.MEAL_PLANNER_SERVICE_URL || "http://localhost:8001";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const userId = await requireUserId(request);

  try {
    const { recipeId, dietaryOptions, specificIngredients } = await request.json();

    if (!recipeId) {
      return json({ error: "Recipe ID is required" }, { status: 400 });
    }

    // Fetch the recipe with ingredients
    const recipe = await db.recipe.findUnique({
      where: { id: recipeId },
      include: {
        ingredients: true,
        instructionSteps: {
          orderBy: { stepNumber: "asc" },
        },
      },
    });

    if (!recipe) {
      return json({ error: "Recipe not found" }, { status: 404 });
    }

    // Verify user has access to this recipe
    const userRecipe = await db.userRecipe.findFirst({
      where: {
        userId,
        recipeId,
      },
    });

    if (!userRecipe) {
      return json({ error: "Unauthorized" }, { status: 403 });
    }

    // Prepare the request payload for the meal-planner-service
    const serviceRequest = {
      recipeId: recipe.id,
      title: recipe.title,
      description: recipe.description || "",
      ingredients: recipe.ingredients.map(ing => ({
        id: ing.id,
        name: ing.name,
        quantity: ing.quantity || "",
        unit: ing.unit || "",
      })),
      instructions: recipe.instructionSteps
        .map(step => `${step.stepNumber}. ${step.description}`)
        .join('\n'),
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      servings: recipe.servings,
      dietaryOptions,
      specificIngredients,
    };

    // Call the meal-planner-service
    const serviceResponse = await fetch(`${MEAL_PLANNER_SERVICE_URL}/recipe-substitutions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serviceRequest),
    });

    if (!serviceResponse.ok) {
      const errorData = await serviceResponse.json().catch(() => ({ detail: 'Service error' }));
      console.error("Meal planner service error:", errorData);
      return json({ 
        error: errorData.detail || "Failed to generate substitutions" 
      }, { status: serviceResponse.status });
    }

    const substitutionResult = await serviceResponse.json();
    
    return json({
      originalRecipe: substitutionResult.originalRecipe,
      substitutedRecipe: substitutionResult.substitutedRecipe,
    });

  } catch (error) {
    console.error("Substitution API error:", error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return json({ 
        error: "Unable to connect to substitution service. Please try again later." 
      }, { status: 503 });
    }
    
    return json({ 
      error: "Failed to generate substitutions" 
    }, { status: 500 });
  }
}