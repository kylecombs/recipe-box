import { JSDOM } from 'jsdom';
import { parseIngredient as parseIngredientNLP, parseIngredientsBatch } from './ingredient-parser.server';

function decodeHtmlEntities(text: string): string {
  // Create a temporary DOM element to decode HTML entities
  const tempElement = new JSDOM('').window.document.createElement('div');
  tempElement.innerHTML = text;
  return tempElement.textContent || tempElement.innerText || text;
}

export interface RecipeData {
  title: string;
  description?: string;
  imageUrl?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  ingredients: Array<{
    name: string;
    quantity?: string;
    unit?: string;
    notes?: string;
  }>;
  instructions: string[];
  tags: string[];
}

export async function parseRecipeFromUrl(url: string): Promise<RecipeData | null> {
  console.log("🌐 Recipe Parser - Starting to parse URL:", url);
  try {
    console.log("📡 Recipe Parser - Fetching URL...");
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    console.log("📡 Recipe Parser - Response status:", response.status, response.statusText);
    
    if (!response.ok) {
      console.error("❌ Recipe Parser - Failed to fetch URL:", response.statusText);
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log("📄 Recipe Parser - HTML length:", html.length);
    
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Try to find JSON-LD structured data first (most reliable)
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    console.log("🔍 Recipe Parser - Found JSON-LD scripts:", jsonLdScripts.length);
    
    for (const jsonLdScript of jsonLdScripts) {
      try {
        const jsonData = JSON.parse(jsonLdScript.textContent || '');
        
        // Handle both single objects and arrays
        const items = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        // Also check for @graph structure
        if (jsonData['@graph']) {
          items.push(...jsonData['@graph']);
        }
        
        const recipe = items.find(item => 
          item['@type'] === 'Recipe' || 
          (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
        );
          
        if (recipe) {
          const parsed = await parseJsonLdRecipe(recipe);
          return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse JSON-LD data:', e);
      }
    }
    // Fallback to microdata parsing
    return await parseMicrodataRecipe(document);
    
  } catch (error) {
    console.error('❌ Recipe Parser - Error parsing recipe from URL:', error);
    console.error('❌ Recipe Parser - Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return null;
  }
}

function isNoBake(recipe: Record<string, unknown>): boolean {
  // Check the recipe title and description for no-bake indicators
  const title = (recipe.name as string || '').toLowerCase();
  const description = (recipe.description as string || '').toLowerCase();
  const instructions = Array.isArray(recipe.recipeInstructions) 
    ? (recipe.recipeInstructions as unknown[]).map(inst => {
        if (typeof inst === 'string') return inst;
        if (inst && typeof inst === 'object') {
          const instruction = inst as Record<string, unknown>;
          return (instruction.text as string) || 
                 (instruction.name as string) || 
                 '';
        }
        return '';
      }).join(' ').toLowerCase()
    : '';
  
  const allText = `${title} ${description} ${instructions}`;
  
  // Look for no-bake indicators
  const noBakeIndicators = [
    'no-bake',
    'no bake',
    'refrigerate',
    'chill',
    'freeze',
    'icebox',
    'no cooking',
    'no heat',
    'raw',
    'uncooked'
  ];
  
  const hasBakeIndicators = noBakeIndicators.some(indicator => allText.includes(indicator));
  
  // Also check if instructions mention refrigeration but no actual cooking
  const hasCookingTerms = /\b(bake|baking|oven|cook|cooking|heat|boil|fry|sauté|simmer|roast|grill)\b/i.test(allText);
  const hasRefrigeration = /\b(refrigerat|chill|freeze)\b/i.test(allText);
  
  // If it has refrigeration terms but no cooking terms, it's likely no-bake
  // Or if it explicitly mentions no-bake terms
  return hasBakeIndicators || (hasRefrigeration && !hasCookingTerms);
}

async function parseJsonLdRecipe(recipe: Record<string, unknown>): Promise<RecipeData> {
  console.log("🔬 JSON-LD Parser - Raw recipe data:");
  console.log("   - prepTime:", recipe.prepTime);
  console.log("   - cookTime:", recipe.cookTime);
  console.log("   - totalTime:", recipe.totalTime);
  console.log("   - recipeInstructions (sample):", Array.isArray(recipe.recipeInstructions) ? recipe.recipeInstructions.slice(0, 2) : recipe.recipeInstructions);
  
  // Check if this is a no-bake recipe
  const isNoBakeRecipe = isNoBake(recipe);
  console.log("🧁 JSON-LD Parser - No-bake detection:", isNoBakeRecipe);
  
  // Collect all ingredient strings for batch parsing
  const ingredientTexts: string[] = [];
  const ingredientMapping: Array<{ index: number; original: unknown; isString: boolean }> = [];
  
  if (Array.isArray(recipe.recipeIngredient)) {
    (recipe.recipeIngredient as unknown[]).forEach((ing: unknown) => {
      if (typeof ing === 'string') {
        ingredientTexts.push(ing);
        ingredientMapping.push({ index: ingredientTexts.length - 1, original: ing, isString: true });
      } else {
        ingredientMapping.push({ index: -1, original: ing, isString: false });
      }
    });
  }
  
  // Parse all ingredients in batch
  const parsedIngredients = ingredientTexts.length > 0 
    ? await parseIngredientsBatch(ingredientTexts)
    : [];
  
  // Map results back to ingredients array
  const ingredients = ingredientMapping.map(mapping => {
    if (mapping.isString && mapping.index >= 0) {
      const parsed = parsedIngredients[mapping.index];
      return {
        name: parsed.name || String(mapping.original),
        quantity: parsed.quantity || undefined,
        unit: parsed.unit || undefined,
        notes: parsed.comment || undefined,
      };
    } else {
      return { name: String(mapping.original) };
    }
  });
    
  // Handle different instruction formats
  let instructions: string[] = [];
  if (Array.isArray(recipe.recipeInstructions)) {
    instructions = (recipe.recipeInstructions as unknown[]).map((inst: unknown) => {
      if (typeof inst === 'string') return inst;
      if (inst && typeof inst === 'object') {
        const instruction = inst as Record<string, unknown>;
        // Check common properties for instruction text
        return (instruction.text as string) || 
               (instruction.name as string) || 
               (instruction['@type'] === 'HowToStep' && instruction.text as string) ||
               '';
      }
      return '';
    }).filter(Boolean);
  }
    
  return {
    title: decodeHtmlEntities((recipe.name as string) || 'Untitled Recipe'),
    description: decodeHtmlEntities((recipe.description as string) || ''),
    imageUrl: getImageUrl(recipe.image),
    prepTimeMinutes: parseTimeToMinutes(recipe.prepTime as string),
    cookTimeMinutes: isNoBakeRecipe ? undefined : parseTimeToMinutes(recipe.cookTime as string),
    servings: parseServings(recipe.recipeYield as string | number),
    ingredients: ingredients.map(ing => ({
      ...ing,
      name: decodeHtmlEntities(ing.name),
      notes: ing.notes ? decodeHtmlEntities(ing.notes) : ing.notes
    })),
    instructions: instructions.map(decodeHtmlEntities),
    tags: parseKeywords(recipe.keywords)
  };
}

async function parseMicrodataRecipe(document: Document): Promise<RecipeData> {
  const getTextContent = (selector: string) => 
    document.querySelector(selector)?.textContent?.trim() || '';
    
  const getAllTextContent = (selector: string) =>
    Array.from(document.querySelectorAll(selector))
      .map(el => el.textContent?.trim())
      .filter(Boolean);
      
  // Common selectors for recipe data
  const title = getTextContent('[itemprop="name"]') || 
                getTextContent('h1') || 
                getTextContent('.recipe-title') ||
                'Untitled Recipe';
                
  let description = getTextContent('[itemprop="description"]') ||
                    getTextContent('.recipe-description') ||
                    getTextContent('.summary');
  
  // If no description found, look for text blocks closest to ingredients
  if (!description) {
    // Find the title element
    const titleElement = document.querySelector('h1') || 
                        document.querySelector('[itemprop="name"]') ||
                        document.querySelector('.recipe-title');
    
    // Find the ingredients section
    const ingredientsElement = document.querySelector('[itemprop="recipeIngredient"]') ||
                              document.querySelector('.recipe-ingredient') ||
                              document.querySelector('.ingredient');
    
    if (titleElement && ingredientsElement) {
      // Get all substantial text blocks after the title
      const potentialDescriptions = Array.from(document.querySelectorAll('p, div'))
        .filter(el => {
          const text = el.textContent?.trim() || '';
          // Must have substantial text (likely description, not just labels)
          return text.length > 50 && text.length < 1000;
        })
        .map(el => {
          const rect = el.getBoundingClientRect?.() || { top: 0 };
          const titleRect = titleElement.getBoundingClientRect?.() || { top: 0 };
          const ingredientsRect = ingredientsElement.getBoundingClientRect?.() || { top: 1000 };
          
          return {
            element: el,
            text: el.textContent?.trim() || '',
            position: rect.top,
            distanceFromTitle: Math.abs(rect.top - titleRect.top),
            distanceFromIngredients: Math.abs(rect.top - ingredientsRect.top),
            isBetweenTitleAndIngredients: rect.top > titleRect.top && rect.top < ingredientsRect.top
          };
        })
        .filter(item => item.isBetweenTitleAndIngredients) // Only consider elements between title and ingredients
        .sort((a, b) => {
          // Sort by distance from ingredients (closest first)
          return a.distanceFromIngredients - b.distanceFromIngredients;
        });
      
      // Take the text block closest to the ingredients
      if (potentialDescriptions.length > 0) {
        description = potentialDescriptions[0].text;
      }
    }
    
    // Alternative approach: look for common description patterns
    if (!description) {
      const descriptionSelectors = [
        '.recipe-intro',
        '.recipe-summary', 
        '.description',
        '.intro',
        '.summary',
        '.recipe-description-text',
        '.recipe-intro-text',
        '[data-description]'
      ];
      
      for (const selector of descriptionSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent?.trim();
          if (text && text.length > 20) {
            description = text;
            break;
          }
        }
      }
    }
    
    // Last resort: find the first substantial paragraph after the title
    if (!description && titleElement) {
      let currentElement = titleElement.nextElementSibling;
      while (currentElement && !description) {
        if (currentElement.tagName === 'P' || currentElement.tagName === 'DIV') {
          const text = currentElement.textContent?.trim() || '';
          // Look for substantial text that looks like a description
          if (text.length > 50 && text.length < 800 && 
              !text.toLowerCase().includes('ingredient') &&
              !text.toLowerCase().includes('instruction') &&
              !text.toLowerCase().includes('direction')) {
            description = text;
            break;
          }
        }
        currentElement = currentElement.nextElementSibling;
      }
    }
  }
                     
  let imageUrl = document.querySelector('[itemprop="image"]')?.getAttribute('src') ||
                 document.querySelector('.recipe-image img')?.getAttribute('src');
  
  // If no obvious recipe image found, look for the largest image near ingredients
  if (!imageUrl) {
    // Find ingredients section first
    const ingredientsSection = document.querySelector('[itemprop="recipeIngredient"]')?.closest('div, section, article') ||
                              document.querySelector('.recipe-ingredient')?.closest('div, section, article') ||
                              document.querySelector('.ingredient')?.closest('div, section, article');
    
    if (ingredientsSection) {
      // Look for images within the same parent container or nearby siblings
      const containerImages = Array.from(ingredientsSection.querySelectorAll('img'));
      
      // If no images in container, check parent and siblings
      if (containerImages.length === 0 && ingredientsSection.parentElement) {
        const parentImages = Array.from(ingredientsSection.parentElement.querySelectorAll('img'));
        containerImages.push(...parentImages);
      }
      
      if (containerImages.length > 0) {
        // Find the largest image by area (width * height from attributes or natural size)
        let largestImage = containerImages[0];
        let largestArea = 0;
        
        for (const img of containerImages) {
          const width = parseInt(img.getAttribute('width') || '0') || img.naturalWidth || 0;
          const height = parseInt(img.getAttribute('height') || '0') || img.naturalHeight || 0;
          const area = width * height;
          
          // Skip very small images (likely icons or thumbnails)
          if (area > 10000 && area > largestArea) {
            largestArea = area;
            largestImage = img;
          }
        }
        
        imageUrl = largestImage.src || largestImage.getAttribute('src');
      }
    }
    
    // Last resort: find the largest image on the entire page
    if (!imageUrl) {
      const allImages = Array.from(document.querySelectorAll('img'));
      let largestImage = null;
      let largestArea = 0;
      
      for (const img of allImages) {
        // Skip common non-recipe images
        const src = img.src || img.getAttribute('src') || '';
        const alt = img.alt || '';
        
        // Skip logos, ads, social media icons, etc.
        if (src.includes('logo') || src.includes('icon') || src.includes('social') || 
            src.includes('ad') || alt.toLowerCase().includes('logo') ||
            alt.toLowerCase().includes('icon')) {
          continue;
        }
        
        const width = parseInt(img.getAttribute('width') || '0') || img.naturalWidth || 0;
        const height = parseInt(img.getAttribute('height') || '0') || img.naturalHeight || 0;
        const area = width * height;
        
        // Look for reasonably large images (likely recipe photos)
        if (area > 50000 && area > largestArea) {
          largestArea = area;
          largestImage = img;
        }
      }
      
      if (largestImage) {
        imageUrl = largestImage.src || largestImage.getAttribute('src');
      }
    }
  }
                   
  const prepTime = getTextContent('[itemprop="prepTime"]');
  const cookTime = getTextContent('[itemprop="cookTime"]');
  const servings = getTextContent('[itemprop="recipeYield"]');
  
  const ingredientTexts = getAllTextContent('[itemprop="recipeIngredient"]') ||
                         getAllTextContent('.recipe-ingredient') ||
                         getAllTextContent('.ingredient');
                         
  // Try multiple strategies to find instructions
  let instructionTexts = getAllTextContent('[itemprop="recipeInstructions"]');
  
  if (!instructionTexts.length) {
    // Common class names for instructions
    const instructionSelectors = [
      '.recipe-instruction',
      '.instruction',
      '.directions li',
      '.recipe-directions li',
      '.method li',
      '.preparation li',
      '.steps li',
      '.recipe-steps li',
      '.instructions-section li',
      '.directions-list li',
      '.method-list li',
      '.recipe-method li',
      '.cooking-instructions li',
      '.step-description',
      '.direction-text',
      '.instruction-text'
    ];
    
    for (const selector of instructionSelectors) {
      instructionTexts = getAllTextContent(selector);
      if (instructionTexts.length > 0) break;
    }
  }
  
  // Search for elements with class names containing "directions" or "instructions"
  if (!instructionTexts.length) {
    const allElements = Array.from(document.querySelectorAll('*[class]'));
    const instructionElements = allElements.filter(el => {
      const className = el.className.toString().toLowerCase();
      return className.includes('directions') || className.includes('instructions');
    });
    
    for (const element of instructionElements) {
      // Try to get list items first
      const listItems = element.querySelectorAll('li');
      if (listItems.length > 0) {
        instructionTexts = Array.from(listItems)
          .map(li => li.textContent?.trim())
          .filter(Boolean);
        if (instructionTexts.length > 0) break;
      }
      
      // If no list items, try paragraphs
      const paragraphs = element.querySelectorAll('p');
      if (paragraphs.length > 0) {
        instructionTexts = Array.from(paragraphs)
          .map(p => p.textContent?.trim())
          .filter(Boolean);
        if (instructionTexts.length > 0) break;
      }
      
      // If no paragraphs, try divs
      const divs = element.querySelectorAll('div');
      if (divs.length > 0) {
        instructionTexts = Array.from(divs)
          .map(div => div.textContent?.trim())
          .filter(text => text && text.length > 10) // Filter out short/empty divs
          .filter(Boolean);
        if (instructionTexts.length > 0) break;
      }
    }
  }
  
  // If still no instructions, look for numbered lists after certain headings
  if (!instructionTexts.length) {
    const headingPatterns = ['method', 'instructions', 'directions', 'steps', 'preparation', 'procedure'];
    
    for (const pattern of headingPatterns) {
      // Find headings that contain these words (case-insensitive)
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .filter(h => h.textContent?.toLowerCase().includes(pattern));
      
      for (const heading of headings) {
        // Look for the next sibling that's a list or contains steps
        let sibling = heading.nextElementSibling;
        while (sibling && instructionTexts.length === 0) {
          if (sibling.tagName === 'OL' || sibling.tagName === 'UL') {
            instructionTexts = getAllTextContent(`#${sibling.id} li`) || 
                              Array.from(sibling.querySelectorAll('li'))
                                .map(li => li.textContent?.trim())
                                .filter(Boolean);
            break;
          }
          // Check if sibling contains ordered lists
          const nestedList = sibling.querySelector('ol, ul');
          if (nestedList) {
            instructionTexts = Array.from(nestedList.querySelectorAll('li'))
              .map(li => li.textContent?.trim())
              .filter(Boolean);
            break;
          }
          sibling = sibling.nextElementSibling;
        }
        if (instructionTexts.length > 0) break;
      }
      if (instructionTexts.length > 0) break;
    }
  }
  
  // Last resort: look for paragraphs that start with step numbers
  if (!instructionTexts.length) {
    const allParagraphs = Array.from(document.querySelectorAll('p'));
    const stepPattern = /^(step\s*\d+|^\d+\.|\d+\))/i;
    instructionTexts = allParagraphs
      .map(p => p.textContent?.trim())
      .filter(text => text && stepPattern.test(text))
      .map(text => text!.replace(stepPattern, '').trim());
  }
  
  console.log("🍽️ Recipe Parser - Final parsed data:");
  console.log("   - Title:", title);
  console.log("   - Description:", description);
  console.log("   - Image URL:", imageUrl);
  console.log("   - Prep time (raw):", prepTime);
  console.log("   - Prep time (parsed):", parseTimeToMinutes(prepTime), "minutes");
  console.log("   - Cook time (raw):", cookTime);
  console.log("   - Cook time (parsed):", parseTimeToMinutes(cookTime), "minutes");
  console.log("   - Servings:", servings, "->", parseServings(servings));
  console.log("   - Ingredients count:", ingredientTexts.filter(Boolean).length);
  console.log("   - Instructions count:", instructionTexts.filter(Boolean).length);
  console.log("   - Instructions:", instructionTexts.map((inst, i) => `${i+1}. ${inst}`));
  
  return {
    title: decodeHtmlEntities(title),
    description: description ? decodeHtmlEntities(description) : undefined,
    imageUrl: imageUrl || undefined,
    prepTimeMinutes: parseTimeToMinutes(prepTime),
    cookTimeMinutes: parseTimeToMinutes(cookTime),
    servings: parseServings(servings),
    ingredients: await Promise.all(
      ingredientTexts.filter(Boolean).map(async text => {
        const parsed = await parseIngredientText(text);
        return {
          ...parsed,
          name: decodeHtmlEntities(parsed.name),
          notes: parsed.notes ? decodeHtmlEntities(parsed.notes) : parsed.notes
        };
      })
    ),
    instructions: instructionTexts.filter((text): text is string => Boolean(text)).map(decodeHtmlEntities),
    tags: generateSmartTags(document, title, description, ingredientTexts.filter((text): text is string => Boolean(text)))
  };
}

async function parseIngredientText(text: string | undefined): Promise<{
  name: string;
  quantity?: string;
  unit?: string;
  notes?: string;
}> {
  if (!text) return { name: "" };
  
  try {
    // Use the NLP-based parser service
    const parsed = await parseIngredientNLP(text.trim());
    
    // Check if the NLP parser actually extracted useful information
    if (parsed.quantity && parsed.unit && parsed.name !== text.trim()) {
      // NLP parser worked, use its results
      return {
        name: parsed.name || text.trim(),
        quantity: parsed.quantity || undefined,
        unit: parsed.unit || undefined,
        notes: parsed.comment || undefined,
      };
    } else {
      // NLP parser didn't extract useful info, use fallback
      throw new Error('NLP parser did not extract useful information');
    }
  } catch (error) {
    console.error('NLP parser failed, using fallback parsing:', error);
    
    // Fallback to basic parsing if NLP service is unavailable
    const cleanText = text.trim();
    
    // Simple regex fallback for basic quantity + unit + name patterns
    const quantityMatch = cleanText.match(/^(\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?)\s+([a-zA-Z]+)\s+(.+)/);
    if (quantityMatch) {
      const [, quantity, unit, name] = quantityMatch;
      return {
        name: name.trim(),
        quantity: quantity.trim(),
        unit: unit.trim(),
      };
    }
    
    // Return original text as name if parsing fails
    return { name: cleanText };
  }
}

function parseTimeToMinutes(timeStr: string): number | undefined {
  if (!timeStr) return undefined;
  
  // Parse ISO 8601 duration (PT15M, PT1H30M, etc.)
  const isoMatch = timeStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (isoMatch) {
    const hours = parseInt(isoMatch[1] || '0');
    const minutes = parseInt(isoMatch[2] || '0');
    return hours * 60 + minutes;
  }
  
  // Parse common text formats
  const textMatch = timeStr.match(/(\d+)\s*(hour|hr|h|minute|min|m)/gi);
  if (textMatch) {
    let totalMinutes = 0;
    textMatch.forEach(match => {
      const [, num, unit] = match.match(/(\d+)\s*(hour|hr|h|minute|min|m)/i) || [];
      const value = parseInt(num);
      if (unit && /hour|hr|h/i.test(unit)) {
        totalMinutes += value * 60;
      } else {
        totalMinutes += value;
      }
    });
    return totalMinutes;
  }
  
  return undefined;
}

function parseServings(servingsStr: string | number): number | undefined {
  if (typeof servingsStr === 'number') return servingsStr;
  if (!servingsStr) return undefined;
  
  const match = servingsStr.toString().match(/(\d+)/);
  return match ? parseInt(match[1]) : undefined;
}

function getImageUrl(image: unknown): string | undefined {
  if (typeof image === 'string') return image;
  if (Array.isArray(image) && image.length > 0) {
    const firstImage = image[0];
    if (typeof firstImage === 'string') return firstImage;
    if (firstImage && typeof firstImage === 'object' && 'url' in firstImage) {
      return firstImage.url as string;
    }
  }
  if (image && typeof image === 'object' && image !== null) {
    const imageObj = image as Record<string, unknown>;
    return (imageObj.url as string) || (imageObj.contentUrl as string);
  }
  return undefined;
}

function parseKeywords(keywords: unknown): string[] {
  if (Array.isArray(keywords)) return keywords.filter((item): item is string => typeof item === 'string');
  if (typeof keywords === 'string') {
    return keywords.split(',').map(k => k.trim()).filter(Boolean);
  }
  return [];
}

function generateSmartTags(document: Document, title: string, description: string | undefined, ingredients: string[]): string[] {
  const tags = new Set<string>();
  
  // 1. Start with any existing keywords from the page
  const keywordElements = document.querySelectorAll('[name="keywords"], [property="keywords"], [itemprop="keywords"]');
  keywordElements.forEach(el => {
    const content = el.getAttribute('content') || el.textContent;
    if (content) {
      content.split(',').forEach(tag => {
        const cleanTag = tag.trim().toLowerCase();
        if (cleanTag) tags.add(cleanTag);
      });
    }
  });
  
  // 2. Extract cuisine type from title and description
  const cuisineKeywords = {
    'italian': ['pasta', 'pizza', 'risotto', 'italian', 'parmesan', 'mozzarella', 'basil'],
    'mexican': ['taco', 'burrito', 'salsa', 'mexican', 'cilantro', 'jalapeño', 'avocado'],
    'asian': ['soy sauce', 'ginger', 'sesame', 'rice', 'noodles', 'stir fry', 'asian'],
    'indian': ['curry', 'turmeric', 'cumin', 'indian', 'garam masala', 'naan', 'basmati'],
    'mediterranean': ['olive oil', 'feta', 'mediterranean', 'olives', 'hummus', 'tahini'],
    'american': ['burger', 'barbecue', 'american', 'cheddar', 'bacon']
  };
  
  const allText = `${title} ${description || ''} ${ingredients.join(' ')}`.toLowerCase();
  
  Object.entries(cuisineKeywords).forEach(([cuisine, keywords]) => {
    if (keywords.some(keyword => allText.includes(keyword))) {
      tags.add(cuisine);
    }
  });
  
  // 3. Extract meal type
  const mealTypes = {
    'breakfast': ['breakfast', 'pancake', 'egg', 'oatmeal', 'cereal', 'toast'],
    'lunch': ['lunch', 'sandwich', 'salad', 'soup', 'wrap'],
    'dinner': ['dinner', 'main course', 'entree', 'roast', 'steak'],
    'dessert': ['dessert', 'cake', 'cookie', 'chocolate', 'sweet', 'sugar', 'frosting'],
    'appetizer': ['appetizer', 'starter', 'dip', 'finger food'],
    'snack': ['snack', 'quick', 'easy', 'bite']
  };
  
  Object.entries(mealTypes).forEach(([meal, keywords]) => {
    if (keywords.some(keyword => allText.includes(keyword))) {
      tags.add(meal);
    }
  });
  
  // 4. Extract dietary restrictions
  const dietaryTags = {
    'vegetarian': ['vegetarian', 'veggie', 'no meat'],
    'vegan': ['vegan', 'plant-based', 'dairy-free'],
    'gluten-free': ['gluten-free', 'gluten free', 'celiac'],
    'healthy': ['healthy', 'low-fat', 'nutritious', 'fresh'],
    'quick': ['quick', 'easy', '15 minutes', '20 minutes', '30 minutes'],
    'comfort food': ['comfort', 'hearty', 'cozy', 'warming']
  };
  
  Object.entries(dietaryTags).forEach(([diet, keywords]) => {
    if (keywords.some(keyword => allText.includes(keyword))) {
      tags.add(diet);
    }
  });
  
  // 5. Extract cooking methods
  const cookingMethods = {
    'baked': ['baked', 'baking', 'oven'],
    'grilled': ['grilled', 'grill', 'barbecue', 'bbq'],
    'fried': ['fried', 'frying', 'deep fry'],
    'slow cooker': ['slow cooker', 'crockpot', 'slow cook'],
    'instant pot': ['instant pot', 'pressure cooker'],
    'no-bake': ['no-bake', 'no bake', 'refrigerate']
  };
  
  Object.entries(cookingMethods).forEach(([method, keywords]) => {
    if (keywords.some(keyword => allText.includes(keyword))) {
      tags.add(method);
    }
  });
  
  // 6. Extract seasonal/occasion tags
  const seasonalTags = {
    'holiday': ['holiday', 'christmas', 'thanksgiving', 'easter'],
    'summer': ['summer', 'grilling', 'cold', 'refreshing'],
    'winter': ['winter', 'warm', 'cozy', 'hot', 'soup'],
    'party': ['party', 'entertaining', 'crowd', 'potluck']
  };
  
  Object.entries(seasonalTags).forEach(([season, keywords]) => {
    if (keywords.some(keyword => allText.includes(keyword))) {
      tags.add(season);
    }
  });
  
  // Convert to array and limit to reasonable number
  return Array.from(tags).slice(0, 10);
}