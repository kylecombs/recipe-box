#!/usr/bin/env python3
import json
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import urlopen, Request
from urllib.parse import urlparse, parse_qs
from urllib.error import HTTPError
import threading
import time

# Load environment variables
def load_env():
    env_vars = {}
    try:
        with open('.env', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key] = value.strip('"').strip("'")
    except FileNotFoundError:
        pass
    
    # Update os.environ with loaded variables
    for key, value in env_vars.items():
        os.environ[key] = value
    
    return env_vars

# Load environment variables
load_env()

class RecipeHandler(BaseHTTPRequestHandler):
    def _send_response(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        if isinstance(data, dict):
            data = json.dumps(data)
        
        self.wfile.write(data.encode('utf-8'))

    def do_OPTIONS(self):
        self._send_response(200, {})

    def do_GET(self):
        if self.path == '/':
            self._send_response(200, {
                "service": "Meal Planner Service", 
                "status": "running"
            })
        else:
            self._send_response(404, {"detail": "Not Found"})

    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            if self.path == '/generate-meal-plan':
                self._handle_meal_plan(request_data)
            elif self.path == '/recipe-substitutions':
                self._handle_substitutions(request_data)
            else:
                self._send_response(404, {"detail": "Endpoint not found"})
                
        except json.JSONDecodeError:
            self._send_response(400, {"detail": "Invalid JSON"})
        except Exception as e:
            print(f"Error: {e}")
            self._send_response(500, {"detail": str(e)})

    def _handle_meal_plan(self, request_data):
        # Extract request parameters
        recipes = request_data.get('recipes', [])
        days = request_data.get('days', 7)
        preferences = request_data.get('preferences', {})
        
        print(f"Received meal plan request: {request_data}")
        
        # Build recipes text
        recipes_text = []
        for r in recipes:
            recipe_text = f"""Recipe ID: {r.get('id')}
Recipe: {r.get('title')}
Ingredients: {', '.join(r.get('ingredients', []))}
Servings: {r.get('servings')}
Prep Time: {r.get('prepTime')} minutes
Cook Time: {r.get('cookTime')} minutes
Tags: {', '.join(r.get('tags', [])) if r.get('tags') else 'None'}"""
            recipes_text.append(recipe_text)
        
        recipes_text_str = '\n\n'.join(recipes_text)
        preferences_text = json.dumps(preferences, indent=2) if preferences else "No specific preferences"
        
        prompt = f"""You are a helpful meal planning assistant. Based on the following recipes available to the user, create a {days}-day meal plan.

Available Recipes:
{recipes_text_str}

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
        
        try:
            response = self._call_anthropic_api(prompt)
            self._send_response(200, response)
        except Exception as e:
            print(f"Meal plan error: {e}")
            self._send_response(500, {"detail": str(e)})

    def _handle_substitutions(self, request_data):
        # Extract request parameters
        recipe_id = request_data.get('recipeId')
        title = request_data.get('title')
        description = request_data.get('description', '')
        ingredients = request_data.get('ingredients', [])
        instructions = request_data.get('instructions')
        prep_time = request_data.get('prepTime')
        cook_time = request_data.get('cookTime')
        servings = request_data.get('servings')
        dietary_options = request_data.get('dietaryOptions', [])
        specific_ingredients = request_data.get('specificIngredients', [])
        
        if not recipe_id or not title or not ingredients or not instructions:
            self._send_response(400, {"detail": "Missing required fields"})
            return
        
        # Prepare ingredient list with specific ones marked for substitution
        ingredients_list = []
        for ing in ingredients:
            needs_substitution = ing.get('id') in specific_ingredients
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
Title: {title}
{f"Description: {description}" if description else ""}

Ingredients:
{ingredients_text}

Instructions:
{instructions}

Requested Modifications:
{f"- Dietary requirements: {', '.join(dietary_options)}" if dietary_options else ""}
{f"- Specific ingredients marked with [SUBSTITUTE] need alternatives" if specific_ingredients else ""}

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
        
        try:
            claude_response = self._call_anthropic_api(prompt, parse_json=True)
            
            # Validate the response structure
            if not claude_response.get('ingredients') or not claude_response.get('instructions') or not claude_response.get('substitutionNotes'):
                self._send_response(500, {"detail": "Invalid response format from AI. Please try again."})
                return
            
            response = {
                "originalRecipe": {
                    "title": title,
                    "description": description,
                    "instructions": instructions,
                    "prepTime": prep_time,
                    "cookTime": cook_time,
                    "servings": servings,
                },
                "substitutedRecipe": {
                    "title": claude_response.get('title', title),
                    "description": claude_response.get('description', description),
                    "ingredients": claude_response['ingredients'],
                    "instructions": claude_response['instructions'],
                    "substitutionNotes": claude_response['substitutionNotes'],
                }
            }
            
            self._send_response(200, response)
            
        except Exception as e:
            print(f"Substitution error: {e}")
            self._send_response(500, {"detail": "Failed to generate substitutions"})

    def _call_anthropic_api(self, prompt, parse_json=False):
        api_key = os.environ.get('ANTHROPIC_API_KEY')
        if not api_key:
            raise Exception("API key not configured. Please add ANTHROPIC_API_KEY to your environment variables.")
        
        # Prepare the request
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01'
        }
        
        data = {
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 4096,
            "temperature": 0.7,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }
        
        # Make the HTTP request
        req = Request(url, data=json.dumps(data).encode('utf-8'), headers=headers)
        
        try:
            with urlopen(req, timeout=60) as response:
                response_data = json.loads(response.read().decode('utf-8'))
                
                if response_data.get('content') and len(response_data['content']) > 0:
                    response_text = response_data['content'][0].get('text', '')
                    
                    if parse_json:
                        # Extract JSON from the response
                        response_text = response_text.strip()
                        if response_text.startswith('```json'):
                            response_text = response_text[7:]
                        if response_text.endswith('```'):
                            response_text = response_text[:-3]
                        response_text = response_text.strip()
                        
                        try:
                            return json.loads(response_text)
                        except json.JSONDecodeError as e:
                            print(f"Failed to parse Claude response: {response_text}")
                            raise Exception("Failed to parse substitution suggestions. Please try again.")
                    else:
                        # For meal planning, parse the JSON response
                        response_text = response_text.strip()
                        if response_text.startswith('```json'):
                            response_text = response_text[7:]
                        if response_text.endswith('```'):
                            response_text = response_text[:-3]
                        response_text = response_text.strip()
                        
                        try:
                            meal_plan_data = json.loads(response_text)
                            return {
                                "week": meal_plan_data.get("week", []),
                                "shopping_list": meal_plan_data.get("shopping_list", []),
                                "notes": meal_plan_data.get("notes", "")
                            }
                        except json.JSONDecodeError as e:
                            raise Exception(f"Failed to parse Claude's response: {str(e)}")
                else:
                    raise Exception("No content in Claude's response")
                    
        except HTTPError as e:
            if e.code == 401:
                raise Exception("API key not configured properly.")
            else:
                raise Exception(f"Claude API error: {e}")
        except Exception as e:
            raise Exception(f"Failed to call Claude API: {str(e)}")

def run_server():
    port = 8001
    server = HTTPServer(('0.0.0.0', port), RecipeHandler)
    print(f"Meal Planner Service running on http://localhost:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.shutdown()

if __name__ == '__main__':
    run_server()