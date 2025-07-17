import { db } from "./db.server";
import { parseRecipeFromUrl } from "./recipe-parser.server";

export interface RecipeData {
  title: string;
  description?: string;
  imageUrl?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  instructions: string[];
  ingredients: Array<{
    name: string;
    quantity?: string;
    unit?: string;
    notes?: string;
    original?: string;
  }>;
  tags: string[];
}

/**
 * Compare two recipe data objects to detect changes
 */
export function hasRecipeChanged(oldRecipe: RecipeData, newRecipe: RecipeData): boolean {
  // Compare basic fields
  if (oldRecipe.title !== newRecipe.title) return true;
  if (oldRecipe.description !== newRecipe.description) return true;
  if (oldRecipe.prepTimeMinutes !== newRecipe.prepTimeMinutes) return true;
  if (oldRecipe.cookTimeMinutes !== newRecipe.cookTimeMinutes) return true;
  if (oldRecipe.servings !== newRecipe.servings) return true;
  
  // Compare instructions
  if (oldRecipe.instructions.length !== newRecipe.instructions.length) return true;
  for (let i = 0; i < oldRecipe.instructions.length; i++) {
    if (oldRecipe.instructions[i] !== newRecipe.instructions[i]) return true;
  }
  
  // Compare ingredients
  if (oldRecipe.ingredients.length !== newRecipe.ingredients.length) return true;
  for (let i = 0; i < oldRecipe.ingredients.length; i++) {
    const oldIng = oldRecipe.ingredients[i];
    const newIng = newRecipe.ingredients[i];
    
    if (oldIng.name !== newIng.name) return true;
    if (oldIng.quantity !== newIng.quantity) return true;
    if (oldIng.unit !== newIng.unit) return true;
    if (oldIng.notes !== newIng.notes) return true;
  }
  
  // Compare tags
  if (oldRecipe.tags.length !== newRecipe.tags.length) return true;
  const oldTagsSet = new Set(oldRecipe.tags);
  const newTagsSet = new Set(newRecipe.tags);
  for (const tag of oldTagsSet) {
    if (!newTagsSet.has(tag)) return true;
  }
  for (const tag of newTagsSet) {
    if (!oldTagsSet.has(tag)) return true;
  }
  
  return false;
}

/**
 * Get the latest version of a recipe by source URL
 */
export async function getLatestRecipeVersion(sourceUrl: string) {
  return await db.recipe.findFirst({
    where: { sourceUrl },
    orderBy: { version: "desc" },
    include: {
      ingredients: true,
      instructionSteps: true,
      tags: {
        include: {
          tag: true,
        },
      },
    },
  });
}

/**
 * Convert database recipe to RecipeData format for comparison
 */
export function dbRecipeToRecipeData(recipe: any): RecipeData {
  return {
    title: recipe.title,
    description: recipe.description || undefined,
    imageUrl: recipe.imageUrl || undefined,
    prepTimeMinutes: recipe.prepTime || undefined,
    cookTimeMinutes: recipe.cookTime || undefined,
    servings: recipe.servings || undefined,
    instructions: recipe.instructionSteps
      .sort((a: any, b: any) => a.stepNumber - b.stepNumber)
      .map((step: any) => step.description),
    ingredients: recipe.ingredients.map((ing: any) => ({
      name: ing.name,
      quantity: ing.quantity || undefined,
      unit: ing.unit || undefined,
      notes: ing.notes || undefined,
      original: ing.original || undefined,
    })),
    tags: recipe.tags.map((rt: any) => rt.tag.name),
  };
}

/**
 * Create a new version of a recipe
 */
export async function createRecipeVersion(
  sourceUrl: string,
  recipeData: RecipeData,
  userId: string,
  parentId?: string
): Promise<any> {
  // Get the current highest version number
  const latestVersion = await db.recipe.findFirst({
    where: { sourceUrl },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  
  const newVersion = latestVersion ? latestVersion.version + 1 : 1;
  
  // Create the new recipe version
  const recipe = await db.recipe.create({
    data: {
      title: recipeData.title,
      description: recipeData.description,
      sourceUrl,
      imageUrl: recipeData.imageUrl,
      prepTime: recipeData.prepTimeMinutes,
      cookTime: recipeData.cookTimeMinutes,
      servings: recipeData.servings,
      instructions: recipeData.instructions.join('\n'),
      version: newVersion,
      parentId: parentId || undefined,
      userId,
      ingredients: {
        create: recipeData.ingredients.map(ing => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          notes: ing.notes,
          original: ing.original || `${ing.quantity || ''} ${ing.unit || ''} ${ing.name}`.trim()
        }))
      },
      instructionSteps: {
        create: recipeData.instructions.map((step, index) => ({
          stepNumber: index + 1,
          description: step
        }))
      },
      tags: {
        create: recipeData.tags ? recipeData.tags.map(tagName => ({
          tag: {
            connectOrCreate: {
              where: { name: tagName },
              create: { name: tagName }
            }
          }
        })) : []
      }
    },
    include: {
      ingredients: true,
      instructionSteps: true,
      tags: {
        include: {
          tag: true,
        },
      },
    },
  });
  
  return recipe;
}

/**
 * Mark older versions as having updates available
 */
export async function markOlderVersionsAsOutdated(sourceUrl: string, latestVersion: number) {
  // Find all user recipes for older versions
  const olderVersions = await db.recipe.findMany({
    where: {
      sourceUrl,
      version: { lt: latestVersion },
    },
    select: { id: true },
  });
  
  const recipeIds = olderVersions.map(r => r.id);
  
  if (recipeIds.length > 0) {
    // Update UserRecipe entries to mark them as having updates
    await db.userRecipe.updateMany({
      where: {
        recipeId: { in: recipeIds },
      },
      data: {
        hasUpdates: true,
      },
    });
  }
}

/**
 * Import or update a recipe from URL with versioning support
 */
export async function importRecipeWithVersioning(url: string, userId: string) {
  // Parse the recipe from the URL
  const newRecipeData = await parseRecipeFromUrl(url);
  
  if (!newRecipeData) {
    throw new Error("Could not extract recipe information from this URL");
  }
  
  // Check if this URL has been imported before
  const existingRecipe = await getLatestRecipeVersion(url);
  
  if (existingRecipe) {
    // Convert existing recipe to comparable format
    const existingRecipeData = dbRecipeToRecipeData(existingRecipe);
    
    // Check if the recipe has changed
    if (hasRecipeChanged(existingRecipeData, newRecipeData)) {
      // Create a new version
      const newVersion = await createRecipeVersion(
        url,
        newRecipeData,
        userId,
        existingRecipe.parentId || existingRecipe.id
      );
      
      // Mark older versions as outdated
      await markOlderVersionsAsOutdated(url, newVersion.version);
      
      return { recipe: newVersion, isNewVersion: true };
    } else {
      // No changes, return the existing recipe
      return { recipe: existingRecipe, isNewVersion: false };
    }
  } else {
    // First time importing this URL
    const newRecipe = await createRecipeVersion(url, newRecipeData, userId);
    return { recipe: newRecipe, isNewVersion: false };
  }
}

/**
 * Associate a user with a recipe version
 */
export async function associateUserWithRecipe(userId: string, recipeId: string) {
  await db.userRecipe.upsert({
    where: {
      userId_recipeId: {
        userId,
        recipeId,
      },
    },
    create: {
      userId,
      recipeId,
    },
    update: {
      importedAt: new Date(),
    },
  });
}