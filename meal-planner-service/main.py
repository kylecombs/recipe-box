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

Return the response as a valid JSON object with this structure:
{{
    "week": [
        {{
            "day": "Monday",
            "breakfast": {{"recipe": "Recipe Title", "notes": "Any modifications"}},
            "lunch": {{"recipe": "Recipe Title", "notes": "Any modifications"}},
            "dinner": {{"recipe": "Recipe Title", "notes": "Any modifications"}}
        }},
        // ... more days
    ],
    "shopping_list": [
        {{"item": "ingredient name", "quantity": "amount", "unit": "unit of measurement"}},
        // ... more items
    ],
    "notes": "General tips or suggestions for the meal plan"
}}

Make sure to only use recipes from the available list. For breakfast, if no breakfast recipes are available, suggest simple options like "Toast and eggs" or "Yogurt and fruit"."""

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)