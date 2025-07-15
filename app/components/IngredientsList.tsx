import { useState } from "react";
import { Scale, Loader2 } from "lucide-react";

interface Ingredient {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  notes: string | null;
}

interface IngredientsListProps {
  ingredients: Ingredient[];
}

interface ConvertedIngredient extends Ingredient {
  convertedQuantity?: string;
  convertedUnit?: string;
  conversionError?: string;
}

export default function IngredientsList({ ingredients }: IngredientsListProps) {
  const [convertedIngredients, setConvertedIngredients] = useState<ConvertedIngredient[]>(ingredients);
  const [isConverting, setIsConverting] = useState(false);
  const [showConverted, setShowConverted] = useState(false);

  const parseQuantity = (quantity: string): number => {
    if (quantity.includes(' ')) {
      // Handle mixed fractions like "1 1/2"
      const parts = quantity.split(' ');
      const whole = parseInt(parts[0]);
      if (parts[1]?.includes('/')) {
        const [num, den] = parts[1].split('/').map(Number);
        return whole + (num / den);
      } else {
        return parseFloat(quantity);
      }
    } else if (quantity.includes('/')) {
      // Handle simple fractions like "1/2"
      const [num, den] = quantity.split('/').map(Number);
      return num / den;
    } else {
      return parseFloat(quantity);
    }
  };

  const convertAllToGrams = async () => {
    setIsConverting(true);
    const converted: ConvertedIngredient[] = [];

    for (const ingredient of ingredients) {
      const convertedIngredient: ConvertedIngredient = { ...ingredient };

      // Skip if no quantity or unit, or already in grams, or count-based
      if (!ingredient.quantity || !ingredient.unit) {
        converted.push(convertedIngredient);
        continue;
      }

      const normalizedUnit = ingredient.unit.toLowerCase();
      if (normalizedUnit === 'gram' || normalizedUnit === 'grams' || normalizedUnit === 'g') {
        converted.push(convertedIngredient);
        continue;
      }

      // Skip count-based ingredients
      if (isCountBasedUnit(ingredient.unit)) {
        converted.push(convertedIngredient);
        continue;
      }

      try {
        const numericValue = parseQuantity(ingredient.quantity);
        if (isNaN(numericValue)) {
          convertedIngredient.conversionError = 'Invalid quantity format';
          converted.push(convertedIngredient);
          continue;
        }

        // First, normalize the ingredient name using the ingredient parser
        const parseResponse = await fetch('/api/parse-ingredient', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: `${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`
          })
        });

        let normalizedName = ingredient.name;
        if (parseResponse.ok) {
          const parseResult = await parseResponse.json();
          if (parseResult.name && parseResult.name.length > 0 && parseResult.name !== ingredient.name) {
            normalizedName = parseResult.name;
          } else {
            // If parsing didn't help, try basic normalization
            normalizedName = ingredient.name
              .toLowerCase()
              .replace(/,.*$/g, '') // Remove everything after first comma
              .replace(/\([^)]*\)/g, '') // Remove parentheses content
              .replace(/\b(skinless|boneless|lean|fresh|organic|raw)\b/g, '') // Remove common modifiers
              .trim();
          }
        } else {
          // Fallback to basic normalization
          normalizedName = ingredient.name
            .toLowerCase()
            .replace(/,.*$/g, '') // Remove everything after first comma
            .replace(/\([^)]*\)/g, '') // Remove parentheses content
            .replace(/\b(skinless|boneless|lean|fresh|organic|raw)\b/g, '') // Remove common modifiers
            .trim();
        }

        const response = await fetch('/api/convert-measurement', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ingredient: normalizedName,
            fromUnit: ingredient.unit,
            toUnit: 'grams',
            value: numericValue
          })
        });

        const result = await response.json();

        if (result.success && result.convertedValue) {
          convertedIngredient.convertedQuantity = Math.round(result.convertedValue).toString();
          convertedIngredient.convertedUnit = 'grams';
        } else {
          convertedIngredient.conversionError = result.error || 'Conversion failed';
        }
      } catch (error) {
        convertedIngredient.conversionError = 'Network error';
      }

      converted.push(convertedIngredient);
    }

    setConvertedIngredients(converted);
    setShowConverted(true);
    setIsConverting(false);
  };

  const resetConversions = () => {
    setConvertedIngredients(ingredients);
    setShowConverted(false);
  };

  const isCountBasedUnit = (unit: string): boolean => {
    const countUnits = [
      'piece', 'pieces', 'clove', 'cloves', 'head', 'heads', 'bulb', 'bulbs', 
      'bunch', 'bunches', 'stalk', 'stalks', 'sprig', 'sprigs', 'leaf', 'leaves', 
      'slice', 'slices', 'large', 'medium', 'small', 'whole', 'item', 'items'
    ];
    return countUnits.includes(unit.toLowerCase());
  };

  const eligibleForConversion = ingredients.filter(ing => 
    ing.quantity && 
    ing.unit && 
    !['gram', 'grams', 'g'].includes(ing.unit.toLowerCase()) &&
    !isCountBasedUnit(ing.unit)
  ).length;

  const conversionFeatureEnabled = false;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-lg">Ingredients</h4>
        
        {conversionFeatureEnabled && eligibleForConversion > 0 && (
          <div className="flex items-center gap-2">
            {showConverted ? (
              <button
                onClick={resetConversions}
                className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Show Original
              </button>
            ) : (
            <button
              onClick={convertAllToGrams}
              disabled={isConverting}
              className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isConverting ? (
                <Loader2 size={14} className="animate-spin mr-2" />
              ) : (
                <Scale size={14} className="mr-2" />
              )}
              {isConverting ? 'Converting...' : 'Convert to grams'}
            </button>)}
          </div>
        )}
      </div>
      
      <ul className="space-y-2">
        {convertedIngredients.map((ingredient) => (
          <li key={ingredient.id} className="flex items-start">
            <span className="text-blue-600 mr-2">•</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {showConverted && ingredient.convertedQuantity ? (
                    <>
                      <span className="text-green-700">
                        {ingredient.convertedQuantity} {ingredient.convertedUnit}
                      </span>
                      <span className="text-gray-500 text-sm ml-2 line-through">
                        {ingredient.quantity} {ingredient.unit}
                      </span>
                    </>
                  ) : (
                    <>
                      {ingredient.quantity && `${ingredient.quantity} `}
                      {ingredient.unit && `${ingredient.unit} `}
                    </>
                  )}
                  {ingredient.name}
                </span>
                
                {showConverted && ingredient.conversionError && (
                  <span className="text-red-600 text-xs">
                    ({ingredient.conversionError})
                  </span>
                )}
              </div>
              {ingredient.notes && (
                <span className="text-gray-600 text-sm ml-1">({ingredient.notes})</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
} 