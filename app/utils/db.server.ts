// Mock database for proof of concept
// In production, this would use Prisma with a real database

interface Recipe {
  id: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  notes: Note[];
  userId: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
  tags: { tag: Tag }[];
  createdAt: Date;
  updatedAt: Date;
}

interface Note {
  id: string;
  text: string;
  createdAt: Date;
}

interface Ingredient {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  notes: string | null;
  recipeId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Instruction {
  id: string;
  stepNumber: number;
  description: string;
  recipeId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Tag {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FindManyOptions {
  where?: {
    userId?: string;
  };
  orderBy?: {
    updatedAt?: 'desc' | 'asc';
  };
}

interface FindFirstOptions {
  where: {
    id: string;
    userId: string;
  };
  include?: Record<string, unknown>;
}

interface CreateRecipeData {
  title: string;
  description?: string;
  sourceUrl?: string;
  imageUrl?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  notes?: Note[];
  userId: string;
  ingredients?: {
    create?: Array<{
      name: string;
      quantity?: string;
      unit?: string;
      notes?: string;
    }>;
  };
  instructions?: {
    create?: Array<{
      stepNumber: number;
      description: string;
    }>;
  };
  tags?: {
    create?: Array<{
      tag: {
        connectOrCreate: {
          where: { name: string };
          create: { name: string };
        };
      };
    }>;
  };
}

interface CreateOptions {
  data: CreateRecipeData;
}

// In-memory storage for demo
declare global {
  var __recipes: Map<string, Recipe> | undefined;
}

const recipes = global.__recipes || (global.__recipes = new Map<string, Recipe>());

export const db = {
  recipe: {
    findMany: async ({ where, orderBy }: FindManyOptions) => {
      const userRecipes = Array.from(recipes.values())
        .filter(r => r.userId === where?.userId);
      
      if (orderBy?.updatedAt === "desc") {
        userRecipes.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      }
      
      return userRecipes;
    },
    
    findFirst: async ({ where, include }: FindFirstOptions) => {
      const recipe = recipes.get(where.id);
      if (!recipe || recipe.userId !== where.userId) {
        return null;
      }
      
      // Migrate legacy notes format to new array format
      if (!Array.isArray(recipe.notes)) {
        if (recipe.notes && typeof recipe.notes === 'string') {
          recipe.notes = [{
            id: 'legacy-note',
            text: recipe.notes as string,
            createdAt: recipe.createdAt || new Date()
          }];
        } else {
          recipe.notes = [];
        }
      }
      
      return recipe;
    },
    
    create: async ({ data }: CreateOptions) => {
      const recipeId = `recipe-${Date.now()}`;
      const now = new Date();
      
      const ingredients = data.ingredients?.create?.map((ing, idx: number) => ({
        id: `ing-${recipeId}-${idx}`,
        recipeId,
        createdAt: now,
        updatedAt: now,
        name: ing.name,
        quantity: ing.quantity || null,
        unit: ing.unit || null,
        notes: ing.notes || null
      })) || [];
      
      const instructions = data.instructions?.create?.map((inst, idx: number) => ({
        id: `inst-${recipeId}-${idx}`,
        recipeId,
        createdAt: now,
        updatedAt: now,
        ...inst
      })) || [];
      
      const tags = data.tags?.create?.map((t, idx: number) => ({
        tag: {
          id: `tag-${idx}`,
          name: t.tag.connectOrCreate.create.name || t.tag.connectOrCreate.where.name,
          createdAt: now,
          updatedAt: now
        }
      })) || [];
      
      const recipe: Recipe = {
        id: recipeId,
        title: data.title,
        description: data.description || null,
        sourceUrl: data.sourceUrl || null,
        imageUrl: data.imageUrl || null,
        prepTime: data.prepTime || null,
        cookTime: data.cookTime || null,
        servings: data.servings || null,
        notes: data.notes || [],
        userId: data.userId,
        ingredients,
        instructions,
        tags,
        createdAt: now,
        updatedAt: now
      };
      
      recipes.set(recipeId, recipe);
      return recipe;
    },
    
    delete: async ({ where }: { where: { id: string; userId: string } }) => {
      const recipe = recipes.get(where.id);
      if (!recipe || recipe.userId !== where.userId) {
        return null;
      }
      
      recipes.delete(where.id);
      return recipe;
    }
  }
}; 