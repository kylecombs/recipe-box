from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from ingredient_parser import parse_ingredient
import uvicorn

app = FastAPI(title="Ingredient Parser Service")

# Add CORS middleware to allow requests from the Remix app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Add your Remix app URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class IngredientInput(BaseModel):
    text: str

class ParsedIngredient(BaseModel):
    name: str
    quantity: Optional[str] = None
    unit: Optional[str] = None
    comment: Optional[str] = None
    original_text: str

class BatchIngredientInput(BaseModel):
    ingredients: List[str]

class BatchParseResponse(BaseModel):
    ingredients: List[ParsedIngredient]

@app.get("/")
def read_root():
    return {"message": "Ingredient Parser Service", "version": "1.0.0"}

def safe_parse_ingredient(text: str) -> ParsedIngredient:
    """Safely parse an ingredient with proper error handling"""
    try:
        import re
        parsed = parse_ingredient(text)
        
        # Extract name safely
        name = ""
        if parsed.name and isinstance(parsed.name, list) and len(parsed.name) > 0:
            name = str(parsed.name[0].text)
        
        # Extract quantity and unit safely  
        quantity = None
        unit = None
        
        # First try to extract original quantity format from text to preserve mixed fractions
        quantity_match = re.match(r'^(\d+(?:\s+\d+/\d+|\.\d+|/\d+)?)\s+', text.strip())
        if quantity_match:
            quantity = quantity_match.group(1)
        
        # Extract unit from parsed result
        if parsed.amount and isinstance(parsed.amount, list) and len(parsed.amount) > 0:
            amount = parsed.amount[0]
            # Only use parsed quantity if we didn't find one with regex
            if not quantity and hasattr(amount, 'quantity') and amount.quantity is not None:
                quantity = str(amount.quantity)
            if hasattr(amount, 'unit') and amount.unit is not None:
                unit = str(amount.unit)
        
        # Extract additional info safely
        notes_parts = []
        
        # Check comment
        if parsed.comment and hasattr(parsed.comment, 'text'):
            notes_parts.append(str(parsed.comment.text))
        
        # Check preparation  
        if parsed.preparation and hasattr(parsed.preparation, 'text'):
            notes_parts.append(str(parsed.preparation.text))
            
        # Check purpose
        if hasattr(parsed, 'purpose') and parsed.purpose and hasattr(parsed.purpose, 'text'):
            notes_parts.append(str(parsed.purpose.text))
        
        comment = ", ".join(notes_parts) if notes_parts else None
        
        # Clean up name
        if name:
            name = name.strip().rstrip(',').strip()
        
        return ParsedIngredient(
            name=name or text,  # Fallback to original text if name is empty
            quantity=quantity,
            unit=unit,
            comment=comment,
            original_text=text
        )
    
    except Exception as e:
        # Fallback parsing if NLP fails
        return ParsedIngredient(
            name=text,
            quantity=None,
            unit=None,
            comment=None,
            original_text=text
        )

@app.post("/parse", response_model=ParsedIngredient)
def parse_single_ingredient(ingredient: IngredientInput):
    """Parse a single ingredient text"""
    return safe_parse_ingredient(ingredient.text)

@app.post("/parse-batch", response_model=BatchParseResponse)
def parse_batch_ingredients(batch: BatchIngredientInput):
    """Parse multiple ingredients at once"""
    parsed_ingredients = []
    
    for ingredient_text in batch.ingredients:
        parsed_ingredients.append(safe_parse_ingredient(ingredient_text))
    
    return BatchParseResponse(ingredients=parsed_ingredients)

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)