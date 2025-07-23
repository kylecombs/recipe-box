import { json, type ActionFunctionArgs } from "@remix-run/node";
import { requireUserId } from "~/utils/auth.server";
import { db } from "~/utils/db.server";

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  
  const intent = formData.get("intent");
  
  if (intent === "rate") {
    const rating = parseInt(formData.get("rating") as string);
    const comment = (formData.get("comment") as string)?.trim() || null;
    const itemType = formData.get("itemType") as string;
    const itemId = formData.get("itemId") as string;
    
    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return json({ success: false, error: "Rating must be between 1 and 5 stars" }, { status: 400 });
    }
    
    // Validate item type
    if (!["recipe", "mealplan"].includes(itemType)) {
      return json({ success: false, error: "Invalid item type" }, { status: 400 });
    }
    
    if (!itemId) {
      return json({ success: false, error: "Item ID is required" }, { status: 400 });
    }
    
    try {
      if (itemType === "recipe") {
        // Verify recipe exists and user has access to it
        const recipe = await db.recipe.findFirst({
          where: { 
            id: itemId,
            // Allow rating any recipe, not just user's own recipes
          },
        });
        
        if (!recipe) {
          return json({ success: false, error: "Recipe not found" }, { status: 404 });
        }
        
        // Upsert recipe rating
        await db.recipeRating.upsert({
          where: {
            userId_recipeId: {
              userId,
              recipeId: itemId,
            },
          },
          create: {
            userId,
            recipeId: itemId,
            rating,
            comment,
          },
          update: {
            rating,
            comment,
            updatedAt: new Date(),
          },
        });
        
        return json({ success: true, message: "Recipe rating saved successfully" });
      } 
      
      if (itemType === "mealplan") {
        // Verify meal plan exists and user owns it
        const mealPlan = await db.mealPlan.findFirst({
          where: { 
            id: itemId,
            userId, // Users can only rate their own meal plans
          },
        });
        
        if (!mealPlan) {
          return json({ success: false, error: "Meal plan not found" }, { status: 404 });
        }
        
        // Upsert meal plan rating
        await db.mealPlanRating.upsert({
          where: {
            userId_mealPlanId: {
              userId,
              mealPlanId: itemId,
            },
          },
          create: {
            userId,
            mealPlanId: itemId,
            rating,
            comment,
          },
          update: {
            rating,
            comment,
            updatedAt: new Date(),
          },
        });
        
        return json({ success: true, message: "Meal plan rating saved successfully" });
      }
    } catch (error) {
      console.error("Error saving rating:", error);
      return json({ success: false, error: "Failed to save rating" }, { status: 500 });
    }
  }
  
  if (intent === "delete") {
    const itemType = formData.get("itemType") as string;
    const itemId = formData.get("itemId") as string;
    
    if (!["recipe", "mealplan"].includes(itemType) || !itemId) {
      return json({ success: false, error: "Invalid parameters" }, { status: 400 });
    }
    
    try {
      if (itemType === "recipe") {
        await db.recipeRating.deleteMany({
          where: {
            userId,
            recipeId: itemId,
          },
        });
      } else if (itemType === "mealplan") {
        await db.mealPlanRating.deleteMany({
          where: {
            userId,
            mealPlanId: itemId,
          },
        });
      }
      
      return json({ success: true, message: "Rating deleted successfully" });
    } catch (error) {
      console.error("Error deleting rating:", error);
      return json({ success: false, error: "Failed to delete rating" }, { status: 500 });
    }
  }
  
  return json({ success: false, error: "Invalid action" }, { status: 400 });
}