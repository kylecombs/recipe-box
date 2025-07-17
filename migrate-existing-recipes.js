// Migration script to associate existing recipes with users
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateExistingRecipes() {
  try {
    console.log('Starting migration of existing recipes...');
    
    // Get all existing recipes
    const existingRecipes = await prisma.recipe.findMany({
      select: {
        id: true,
        userId: true,
        title: true,
      },
    });
    
    console.log(`Found ${existingRecipes.length} existing recipes`);
    
    // Create UserRecipe entries for each existing recipe
    const userRecipeData = existingRecipes.map(recipe => ({
      userId: recipe.userId,
      recipeId: recipe.id,
      hasUpdates: false,
    }));
    
    if (userRecipeData.length > 0) {
      await prisma.userRecipe.createMany({
        data: userRecipeData,
        skipDuplicates: true, // Skip if already exists
      });
      
      console.log(`Created ${userRecipeData.length} UserRecipe associations`);
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateExistingRecipes();