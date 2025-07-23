import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { RecipeData } from './recipe-parser.server';
import { parseIngredientsBatch } from './ingredient-parser.server';

interface ProcessedImageResult {
  text: string;
  confidence: number;
}

interface ExtractedRecipeData {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  servings?: number;
  prepTime?: string;
  cookTime?: string;
}

/**
 * Process image to extract text using OCR
 */
export async function extractTextFromImage(imageBuffer: Buffer): Promise<ProcessedImageResult> {
  // Preprocess image for better OCR results
  const processedImage = await sharp(imageBuffer)
    .resize(2000, null, { // Resize to reasonable width while maintaining aspect ratio
      withoutEnlargement: true,
    })
    .grayscale() // Convert to grayscale for better OCR
    .normalize() // Enhance contrast
    .toBuffer();

  const worker = await createWorker('eng');
  
  try {
    const { data } = await worker.recognize(processedImage);
    await worker.terminate();
    
    return {
      text: data.text,
      confidence: data.confidence,
    };
  } catch (error) {
    await worker.terminate();
    throw error;
  }
}

/**
 * Parse recipe data from extracted text (internal helper)
 */
function parseRecipeDataFromRawText(text: string): ExtractedRecipeData {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  
  const recipe: ExtractedRecipeData = {
    title: '',
    ingredients: [],
    instructions: [],
  };
  
  let currentSection: 'title' | 'description' | 'ingredients' | 'instructions' | 'none' = 'title';
  const titleCandidates: string[] = [];
  
  // Common section headers
  const ingredientHeaders = /^(ingredients?|shopping list|you('ll)? need|what you need):?$/i;
  const instructionHeaders = /^(instructions?|directions?|method|steps?|preparation|how to make):?$/i;
  const servingsPattern = /(?:serves?|servings?|yield|makes?)[\s:]*(\d+)/i;
  const timePattern = /(?:(prep|preparation|cook|cooking|total)\s*time?)[\s:]*(\d+\s*(?:hours?|hrs?|minutes?|mins?))/i;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Extract servings
    const servingsMatch = line.match(servingsPattern);
    if (servingsMatch && !recipe.servings) {
      recipe.servings = parseInt(servingsMatch[1]);
    }
    
    // Extract time
    const timeMatch = line.match(timePattern);
    if (timeMatch) {
      const [, type, time] = timeMatch;
      if (type?.toLowerCase().includes('prep')) {
        recipe.prepTime = time;
      } else if (type?.toLowerCase().includes('cook')) {
        recipe.cookTime = time;
      }
    }
    
    // Check for section headers
    if (ingredientHeaders.test(line)) {
      currentSection = 'ingredients';
      continue;
    }
    
    if (instructionHeaders.test(line)) {
      currentSection = 'instructions';
      continue;
    }
    
    // Process based on current section
    switch (currentSection) {
      case 'title':
        // First few substantial lines are title candidates
        if (line.length > 5 && line.length < 100 && titleCandidates.length < 3) {
          titleCandidates.push(line);
        }
        // If we see ingredients or instructions pattern, we've passed the title
        if (ingredientHeaders.test(line) || instructionHeaders.test(line) || 
            line.match(/^\d+[.)]/)) {
          currentSection = 'none';
          // Choose the most likely title (usually the first or longest)
          recipe.title = titleCandidates[0] || 'Untitled Recipe';
          // Look for description in remaining title candidates
          if (titleCandidates.length > 1) {
            // Skip very short lines that are likely not descriptions
            const descriptionCandidates = titleCandidates.slice(1).filter(t => t.length > 20);
            if (descriptionCandidates.length > 0) {
              recipe.description = descriptionCandidates[0];
            }
          }
        }
        break;
        
      case 'ingredients':
        // Look for ingredient patterns
        if (line.match(/^[-•*]\s*/) || // Starts with bullet points
            line.match(/^[\d\s¼½¾⅓⅔⅛⅜⅝⅞/]+/) || // Starts with numbers or fractions
            line.match(/^(one|two|three|four|five|six|seven|eight|nine|ten)\s/i) || // Starts with number words
            line.includes('cup') || line.includes('tbsp') || line.includes('tsp') ||
            line.includes('oz') || line.includes('pound') || line.includes('gram') ||
            line.includes('ml') || line.includes('liter') || line.includes('kg') ||
            line.match(/\d+\s*(cup|tbsp|tsp|oz|lb|pound|gram|ml|liter|kg|clove|bunch)/i)) {
          // Clean up bullet points and extra whitespace
          const cleanedLine = line.replace(/^[-•*]\s*/, '').trim();
          if (cleanedLine) {
            recipe.ingredients.push(cleanedLine);
          }
        } else if (instructionHeaders.test(line)) {
          currentSection = 'instructions';
        } else if (line.length > 10 && !line.match(/^(serves?|servings?|prep|cook|total)/i)) {
          // Assume it's an ingredient if it's substantial and not clearly something else
          recipe.ingredients.push(line);
        }
        break;
        
      case 'instructions':
        // Look for instruction patterns
        if (line.match(/^[-•*]\s*/) || // Starts with bullet points
            line.match(/^(step\s*)?\d+[.):]?\s*/i) || // Numbered steps
            line.match(/^[a-z]\.\s*/i) || // Lettered steps
            line.length > 15) { // Substantial lines are likely instructions
          // Remove step numbers and bullet points if present
          let cleanedLine = line.replace(/^[-•*]\s*/, '').trim();
          cleanedLine = cleanedLine.replace(/^(step\s*)?\d+[.):]?\s*/i, '').trim();
          cleanedLine = cleanedLine.replace(/^[a-z]\.\s*/i, '').trim();
          
          if (cleanedLine && cleanedLine.length > 5) {
            recipe.instructions.push(cleanedLine);
          }
        }
        break;
    }
  }
  
  // Fallback if no title was found
  if (!recipe.title && lines.length > 0) {
    recipe.title = lines[0].substring(0, 100);
  }
  
  return recipe;
}

/**
 * Parse recipe data from text directly (for copy-paste functionality)
 */
export async function parseRecipeFromText(text: string): Promise<RecipeData> {
  // Parse recipe from the provided text
  const extractedData = parseRecipeDataFromRawText(text);
  
  // Parse ingredients using the NLP service
  const parsedIngredients = extractedData.ingredients.length > 0
    ? await parseIngredientsBatch(extractedData.ingredients)
    : [];
  
  // Convert to RecipeData format
  const recipeData: RecipeData = {
    title: extractedData.title,
    description: extractedData.description,
    servings: extractedData.servings,
    prepTimeMinutes: parseTimeToMinutes(extractedData.prepTime),
    cookTimeMinutes: parseTimeToMinutes(extractedData.cookTime),
    ingredients: parsedIngredients.map(ing => ({
      name: ing.name,
      quantity: ing.quantity || undefined,
      unit: ing.unit || undefined,
      notes: ing.comment || undefined,
    })),
    instructions: extractedData.instructions,
    tags: generateTagsFromRecipe(extractedData),
  };
  
  return recipeData;
}

/**
 * Process a recipe image and extract recipe data
 */
export async function parseRecipeFromImage(imageBuffer: Buffer): Promise<RecipeData> {
  // Extract text from image
  const { text, confidence } = await extractTextFromImage(imageBuffer);
  
  if (confidence < 50) {
    throw new Error('Image quality is too low for reliable text extraction');
  }
  
  // Parse recipe from extracted text
  const extractedData = parseRecipeDataFromRawText(text);
  
  // Parse ingredients using the NLP service
  const parsedIngredients = extractedData.ingredients.length > 0
    ? await parseIngredientsBatch(extractedData.ingredients)
    : [];
  
  // Convert to RecipeData format
  const recipeData: RecipeData = {
    title: extractedData.title,
    description: extractedData.description,
    servings: extractedData.servings,
    prepTimeMinutes: parseTimeToMinutes(extractedData.prepTime),
    cookTimeMinutes: parseTimeToMinutes(extractedData.cookTime),
    ingredients: parsedIngredients.map(ing => ({
      name: ing.name,
      quantity: ing.quantity || undefined,
      unit: ing.unit || undefined,
      notes: ing.comment || undefined,
    })),
    instructions: extractedData.instructions,
    tags: generateTagsFromRecipe(extractedData),
  };
  
  return recipeData;
}

/**
 * Helper function to parse time strings to minutes
 */
function parseTimeToMinutes(timeStr?: string): number | undefined {
  if (!timeStr) return undefined;
  
  let totalMinutes = 0;
  
  // Match hours
  const hourMatch = timeStr.match(/(\d+)\s*(?:hours?|hrs?)/i);
  if (hourMatch) {
    totalMinutes += parseInt(hourMatch[1]) * 60;
  }
  
  // Match minutes
  const minuteMatch = timeStr.match(/(\d+)\s*(?:minutes?|mins?)/i);
  if (minuteMatch) {
    totalMinutes += parseInt(minuteMatch[1]);
  }
  
  return totalMinutes > 0 ? totalMinutes : undefined;
}

/**
 * Generate smart tags based on recipe content
 */
function generateTagsFromRecipe(recipe: ExtractedRecipeData): string[] {
  const tags = new Set<string>();
  const content = `${recipe.title} ${recipe.description || ''} ${recipe.ingredients.join(' ')} ${recipe.instructions.join(' ')}`.toLowerCase();
  
  // Quick recipes
  const totalTime = (parseTimeToMinutes(recipe.prepTime) || 0) + (parseTimeToMinutes(recipe.cookTime) || 0);
  if (totalTime && totalTime <= 30) {
    tags.add('quick');
  }
  
  // Meal types
  const mealTypes = {
    'breakfast': ['breakfast', 'brunch', 'morning', 'eggs', 'pancake', 'waffle', 'cereal', 'oatmeal'],
    'lunch': ['lunch', 'sandwich', 'salad', 'soup'],
    'dinner': ['dinner', 'supper', 'main course', 'entree'],
    'dessert': ['dessert', 'cake', 'cookie', 'pie', 'sweet', 'chocolate', 'ice cream'],
    'snack': ['snack', 'appetizer', 'bite', 'quick'],
  };
  
  for (const [meal, keywords] of Object.entries(mealTypes)) {
    if (keywords.some(keyword => content.includes(keyword))) {
      tags.add(meal);
    }
  }
  
  // Dietary tags
  if (content.includes('vegan') || content.includes('plant-based')) {
    tags.add('vegan');
  }
  if (content.includes('vegetarian') || !content.match(/chicken|beef|pork|fish|meat|turkey/)) {
    tags.add('vegetarian');
  }
  if (content.includes('gluten-free') || content.includes('gluten free')) {
    tags.add('gluten-free');
  }
  
  // Cooking methods
  const cookingMethods = ['baked', 'grilled', 'fried', 'roasted', 'steamed', 'slow cooker', 'instant pot'];
  for (const method of cookingMethods) {
    if (content.includes(method)) {
      tags.add(method);
    }
  }
  
  return Array.from(tags).slice(0, 10);
}

/**
 * Validate if buffer is a valid image
 */
export async function validateImageBuffer(buffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata();
    return !!(metadata.width && metadata.height && metadata.format);
  } catch {
    return false;
  }
}