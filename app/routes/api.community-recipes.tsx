import { json, type ActionFunctionArgs } from "@remix-run/node";
import { requireUserId } from "~/utils/auth.server";
import { db } from "~/utils/db.server";

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  
  const intent = formData.get("intent");
  
  if (intent === "save") {
    const recipeId = formData.get("recipeId") as string;
    
    if (!recipeId) {
      return json({ success: false, error: "Recipe ID is required" }, { status: 400 });
    }
    
    try {
      // Check if recipe exists and is public
      const recipe = await db.recipe.findFirst({
        where: { 
          id: recipeId,
          isPublic: true,
        },
      });
      
      if (!recipe) {
        return json({ success: false, error: "Recipe not found or not public" }, { status: 404 });
      }

      // Check if user already has this recipe
      const existingUserRecipe = await db.userRecipe.findFirst({
        where: {
          userId,
          recipeId,
        },
      });

      if (existingUserRecipe) {
        return json({ success: false, error: "Recipe already saved to your collection" }, { status: 400 });
      }

      // Check if user is trying to save their own recipe
      if (recipe.userId === userId) {
        return json({ success: false, error: "You cannot save your own recipe" }, { status: 400 });
      }

      // Create UserRecipe entry and increment save count
      await db.$transaction([
        db.userRecipe.create({
          data: {
            userId,
            recipeId,
            savedFromPublic: true,
          },
        }),
        db.recipe.update({
          where: { id: recipeId },
          data: {
            saveCount: {
              increment: 1,
            },
          },
        }),
      ]);
      
      return json({ 
        success: true, 
        message: "Recipe saved to your collection!" 
      });
    } catch (error) {
      console.error("Error saving recipe:", error);
      return json({ success: false, error: "Failed to save recipe" }, { status: 500 });
    }
  }
  
  if (intent === "unsave") {
    const recipeId = formData.get("recipeId") as string;
    
    if (!recipeId) {
      return json({ success: false, error: "Recipe ID is required" }, { status: 400 });
    }
    
    try {
      // Find the UserRecipe entry
      const userRecipe = await db.userRecipe.findFirst({
        where: {
          userId,
          recipeId,
          savedFromPublic: true,
        },
      });

      if (!userRecipe) {
        return json({ success: false, error: "Recipe not found in your collection" }, { status: 404 });
      }

      // Remove UserRecipe entry and decrement save count
      await db.$transaction([
        db.userRecipe.delete({
          where: { id: userRecipe.id },
        }),
        db.recipe.update({
          where: { id: recipeId },
          data: {
            saveCount: {
              decrement: 1,
            },
          },
        }),
      ]);
      
      return json({ 
        success: true, 
        message: "Recipe removed from your collection" 
      });
    } catch (error) {
      console.error("Error unsaving recipe:", error);
      return json({ success: false, error: "Failed to remove recipe" }, { status: 500 });
    }
  }
  
  return json({ success: false, error: "Invalid action" }, { status: 400 });
}