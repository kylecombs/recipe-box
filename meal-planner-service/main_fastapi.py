from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import os
from dotenv import load_dotenv
from anthropic import Anthropic
import json

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

anthropic_client = Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY"),
)

class Recipe(BaseModel):
    id: str
    title: str
    ingredients: List[str]
    instructions: str
    servings: int
    cookTime: int
    prepTime: int
    tags: List[str] = []

class MealPlanRequest(BaseModel):
    recipes: List[Recipe]
    days: int = 7
    preferences: Dict[str, Any] = {}

class MealPlan(BaseModel):
    week: List[Dict[str, Any]]
    shopping_list: List[Dict[str, Any]]
    notes: str

class SubstitutionRequest(BaseModel):
    recipeId: str
    title: str
    description: str = ""
    ingredients: List[Dict[str, Any]]
    instructions: str
    prepTime: int = None
    cookTime: int = None
    servings: int = None
    dietaryOptions: List[str] = []
    specificIngredients: List[str] = []

class SubstitutionResponse(BaseModel):
    originalRecipe: Dict[str, Any]
    substitutedRecipe: Dict[str, Any]

@app.get("/")
def read_root():
    return {"service": "Meal Planner Service", "status": "running"}

@app.post("/generate-meal-plan", response_model=MealPlan)
async def generate_meal_plan(request: MealPlanRequest):
    try:
        print(f"Received request: {request}")
        print(f"API key available: {'ANTHROPIC_API_KEY' in os.environ}")
        print(f"API key starts with: {os.getenv('ANTHROPIC_API_KEY', '')[:10]}...")
        recipes_text = "\n\n".join([
            f"Recipe ID: {r.id}\n"
            f"Recipe: {r.title}\n"
            f"Ingredients: {', '.join(r.ingredients)}\n"
            f"Servings: {r.servings}\n"
            f"Prep Time: {r.prepTime} minutes\n"
            f"Cook Time: {r.cookTime} minutes\n"
            f"Tags: {', '.join(r.tags) if r.tags else 'None'}"
            for r in request.recipes
        ])
        
        preferences_text = json.dumps(request.preferences, indent=2) if request.preferences else "No specific preferences"
        
        prompt = f"""You are a helpful meal planning assistant. Based on the following recipes available to the user, create a {request.days}-day meal plan.

Available Recipes:
{recipes_text}

User Preferences:
{preferences_text}

Please create a meal plan that:
1. Uses the available recipes efficiently
2. Provides variety throughout the week
3. Considers the cooking time and complexity
4. Minimizes food waste by using similar ingredients across meals
5. Includes breakfast, lunch, and dinner for each day
6. IMPORTANT: When using a recipe from the available list, include both the recipe title AND the recipe ID

Return the response as a valid JSON object with this structure:
{{
    "week": [
        {{
            "day": "Monday",
            "breakfast": {{"recipe": "Recipe Title", "recipeId": "recipe-id-if-from-available-list", "notes": "Any modifications"}},
            "lunch": {{"recipe": "Recipe Title", "recipeId": "recipe-id-if-from-available-list", "notes": "Any modifications"}},
            "dinner": {{"recipe": "Recipe Title", "recipeId": "recipe-id-if-from-available-list", "notes": "Any modifications"}}
        }},
        // ... more days
    ],
    "shopping_list": [
        {{"item": "ingredient name", "quantity": "amount", "unit": "unit of measurement"}},
        // ... more items
    ],
    "notes": "General tips or suggestions for the meal plan"
}}

Make sure to only use recipes from the available list. For breakfast, if no breakfast recipes are available, suggest simple options like "Toast and eggs" or "Yogurt and fruit" (these should NOT have a recipeId since they're not from the available recipes).

IMPORTANT: 
- If using a recipe from the available list, ALWAYS include the recipeId field with the exact ID provided
- If suggesting a simple meal not from the list, do NOT include a recipeId field
- Double-check that recipe IDs match exactly with the ones provided in the available recipes list"""

        message = anthropic_client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4000,
            temperature=0.7,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        
        response_text = message.content[0].text
        
        try:
            response_text = response_text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            meal_plan_data = json.loads(response_text)
            
            return MealPlan(
                week=meal_plan_data.get("week", []),
                shopping_list=meal_plan_data.get("shopping_list", []),
                notes=meal_plan_data.get("notes", "")
            )
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=500, detail=f"Failed to parse Claude's response: {str(e)}")
    
    except Exception as e:
        print(f"Error occurred: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/recipe-substitutions", response_model=SubstitutionResponse)
async def generate_recipe_substitutions(request: SubstitutionRequest):
    try:
        # Prepare ingredient list with specific ones marked for substitution
        ingredients_list = []
        for ing in request.ingredients:
            needs_substitution = ing.get('id') in request.specificIngredients
            quantity = ing.get('quantity', '')
            unit = ing.get('unit', '')
            name = ing.get('name', '')
            
            ingredient_text = f"{quantity} {unit} {name}".strip()
            if needs_substitution:
                ingredient_text = f"[SUBSTITUTE] {ingredient_text}"
            ingredients_list.append(ingredient_text)

        ingredients_text = '\n'.join(ingredients_list)
        
        # Build the prompt for Claude
        prompt = f"""You are a professional chef helping to modify a recipe based on dietary requirements and ingredient substitutions.

Original Recipe:
Title: {request.title}
{f"Description: {request.description}" if request.description else ""}

Ingredients:
{ingredients_text}

Instructions:
{request.instructions}

Requested Modifications:
{f"- Dietary requirements: {', '.join(request.dietaryOptions)}" if request.dietaryOptions else ""}
{f"- Specific ingredients marked with [SUBSTITUTE] need alternatives" if request.specificIngredients else ""}

Please provide:
1. A modified ingredients list with appropriate substitutions
2. Updated instructions if any cooking methods need to change
3. Important notes about the substitutions and how they affect the recipe

Format your response as JSON with this structure:
{{
  "title": "Modified recipe title if needed",
  "description": "Updated description if needed",
  "ingredients": [
    {{"name": "ingredient name", "quantity": "amount", "unit": "unit of measurement"}}
  ],
  "instructions": "Step-by-step instructions, separated by newlines",
  "substitutionNotes": "Detailed notes about the substitutions made and any important considerations"
}}"""

        message = anthropic_client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4096,
            temperature=0.7,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        
        response_text = message.content[0].text
        
        # Parse the JSON response
        try:
            # Extract JSON from the response (Claude might add explanation before/after)
            response_text = response_text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            substituted_recipe = json.loads(response_text)
        except json.JSONDecodeError as e:
            print(f"Failed to parse Claude response: {response_text}")
            raise HTTPException(status_code=500, detail="Failed to parse substitution suggestions. Please try again.")
        
        # Validate the response structure
        if not substituted_recipe.get('ingredients') or not substituted_recipe.get('instructions') or not substituted_recipe.get('substitutionNotes'):
            raise HTTPException(status_code=500, detail="Invalid response format from AI. Please try again.")
        
        return SubstitutionResponse(
            originalRecipe={
                "title": request.title,
                "description": request.description,
                "instructions": request.instructions,
                "prepTime": request.prepTime,
                "cookTime": request.cookTime,
                "servings": request.servings,
            },
            substitutedRecipe={
                "title": substituted_recipe.get('title', request.title),
                "description": substituted_recipe.get('description', request.description),
                "ingredients": substituted_recipe['ingredients'],
                "instructions": substituted_recipe['instructions'],
                "substitutionNotes": substituted_recipe['substitutionNotes'],
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Substitution error occurred: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to generate substitutions")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)