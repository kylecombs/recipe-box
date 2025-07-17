# Meal Planner Service

A Python microservice that uses Claude AI to generate personalized meal plans based on users' saved recipes.

## Setup

1. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

2. Add your Anthropic API key to the `.env` file:
   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running Locally

```bash
python main.py
```

The service will be available at http://localhost:8001

## Running with Docker

The service is included in the main docker-compose.yml file:

```bash
docker-compose up meal-planner
```

## API Endpoints

### GET /
Health check endpoint

### POST /generate-meal-plan
Generate a meal plan based on provided recipes

Request body:
```json
{
  "recipes": [
    {
      "id": 1,
      "title": "Recipe Name",
      "ingredients": ["ingredient 1", "ingredient 2"],
      "instructions": "Cooking instructions",
      "servings": 4,
      "cookTime": 30,
      "prepTime": 15,
      "tags": ["tag1", "tag2"]
    }
  ],
  "days": 7,
  "preferences": {
    "dietaryRestrictions": "vegetarian",
    "avoidIngredients": "nuts",
    "preferredCuisines": "Italian"
  }
}
```

Response:
```json
{
  "week": [
    {
      "day": "Monday",
      "breakfast": {"recipe": "Recipe Name", "notes": "Notes"},
      "lunch": {"recipe": "Recipe Name", "notes": "Notes"},
      "dinner": {"recipe": "Recipe Name", "notes": "Notes"}
    }
  ],
  "shopping_list": [
    {"item": "ingredient", "quantity": "2", "unit": "cups"}
  ],
  "notes": "General meal plan tips"
}
```