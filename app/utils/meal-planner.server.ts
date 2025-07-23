/**
 * Client for the Python meal planner service
 */

export interface Recipe {
  id: string;
  title: string;
  ingredients: string[];
  instructions: string;
  servings: number;
  cookTime: number;
  prepTime: number;
  tags?: string[];
}

export interface MealPlanRequest {
  recipes: Recipe[];
  days?: number;
  preferences?: Record<string, any>;
}

export interface MealPlanDay {
  day: string;
  breakfast: {
    recipe: string;
    notes: string;
  };
  lunch: {
    recipe: string;
    notes: string;
  };
  dinner: {
    recipe: string;
    notes: string;
  };
}

export interface ShoppingListItem {
  item: string;
  quantity: string;
  unit: string;
}

export interface MealPlan {
  week: MealPlanDay[];
  shopping_list: ShoppingListItem[];
  notes: string;
}

const MEAL_PLANNER_SERVICE_URL = process.env.MEAL_PLANNER_URL || 'http://localhost:8001';

/**
 * Generate a meal plan using the Claude API
 */
export async function generateMealPlan(request: MealPlanRequest): Promise<MealPlan> {
  try {
    const response = await fetch(`${MEAL_PLANNER_SERVICE_URL}/generate-meal-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Meal planner service error: ${response.statusText} - ${errorData}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Failed to generate meal plan:', error);
    throw new Error('Failed to generate meal plan. Please try again later.');
  }
}

/**
 * Check if the meal planner service is healthy
 */
export async function checkMealPlannerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${MEAL_PLANNER_SERVICE_URL}/`);
    if (!response.ok) return false;
    
    const data = await response.json();
    return data.status === 'running';
  } catch (error) {
    console.error('Meal planner service health check failed:', error);
    return false;
  }
}