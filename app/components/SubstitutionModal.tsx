import { useState } from "react";
import { X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { Ingredient, Recipe } from "@prisma/client";

interface SubstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe & { ingredients: Ingredient[] };
  recipeTags: string[];
  onSubstitute: (options: SubstitutionOptions) => void;
  isLoading?: boolean;
}

export interface SubstitutionOptions {
  dietaryOptions: string[];
  specificIngredients: string[];
}

const DIETARY_OPTIONS = [
  { value: "vegetarian", label: "Make it vegetarian", hiddenTags: ["vegetarian", "vegan"] },
  { value: "vegan", label: "Make it vegan", hiddenTags: ["vegan"] },
  { value: "gluten-free", label: "Make it gluten-free", hiddenTags: ["gluten-free", "gluten free"] },
  { value: "dairy-free", label: "Make it dairy-free", hiddenTags: ["dairy-free", "dairy free", "vegan"] },
  { value: "low-sodium", label: "Make it low-sodium", hiddenTags: ["low-sodium", "low sodium"] },
  { value: "low-carb", label: "Make it low-carb", hiddenTags: ["low-carb", "low carb", "keto"] },
  { value: "nut-free", label: "Make it nut-free", hiddenTags: ["nut-free", "nut free"] },
  { value: "paleo", label: "Make it paleo", hiddenTags: ["paleo"] },
  { value: "whole30", label: "Make it Whole30 compliant", hiddenTags: ["whole30"] },
];

export default function SubstitutionModal({ 
  isOpen, 
  onClose, 
  recipe, 
  recipeTags,
  onSubstitute,
  isLoading = false
}: SubstitutionModalProps) {
  const [selectedDietaryOptions, setSelectedDietaryOptions] = useState<string[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [showIngredients, setShowIngredients] = useState(false);

  if (!isOpen) return null;

  const handleDietaryChange = (option: string) => {
    setSelectedDietaryOptions(prev =>
      prev.includes(option)
        ? prev.filter(o => o !== option)
        : [...prev, option]
    );
  };

  const handleIngredientChange = (ingredientId: string) => {
    setSelectedIngredients(prev =>
      prev.includes(ingredientId)
        ? prev.filter(id => id !== ingredientId)
        : [...prev, ingredientId]
    );
  };

  const handleSubmit = () => {
    if (selectedDietaryOptions.length === 0 && selectedIngredients.length === 0) {
      return;
    }
    
    onSubstitute({
      dietaryOptions: selectedDietaryOptions,
      specificIngredients: selectedIngredients,
    });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Filter dietary options based on existing recipe tags
  const availableDietaryOptions = DIETARY_OPTIONS.filter(option => {
    const lowerCaseTags = recipeTags.map(tag => tag.toLowerCase());
    return !option.hiddenTags.some(hiddenTag => lowerCaseTags.includes(hiddenTag));
  });

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Recipe Substitutions</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Dietary Options */}
          <div className="mb-6">
            <h3 className="font-medium mb-3">Dietary Modifications</h3>
            <div className="space-y-2">
              {availableDietaryOptions.map(option => (
                <label
                  key={option.value}
                  className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    value={option.value}
                    checked={selectedDietaryOptions.includes(option.value)}
                    onChange={() => handleDietaryChange(option.value)}
                    className="mr-3 w-4 h-4 text-blue-600 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                  <span className="text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Specific Ingredients */}
          <div>
            <button
              onClick={() => setShowIngredients(!showIngredients)}
              className="flex items-center justify-between w-full p-3 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
              disabled={isLoading}
            >
              <span className="font-medium">Substitute Specific Ingredients</span>
              {showIngredients ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            
            {showIngredients && (
              <div className="mt-3 space-y-2 pl-2">
                {recipe.ingredients.map(ingredient => (
                  <label
                    key={ingredient.id}
                    className="flex items-start p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      value={ingredient.id}
                      checked={selectedIngredients.includes(ingredient.id)}
                      onChange={() => handleIngredientChange(ingredient.id)}
                      className="mr-3 mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                      disabled={isLoading}
                    />
                    <div className="flex-1">
                      <span className="text-gray-700">{ingredient.name}</span>
                      {(ingredient.quantity || ingredient.unit) && (
                        <span className="text-sm text-gray-500 ml-2">
                          ({ingredient.quantity} {ingredient.unit})
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              isLoading || 
              (selectedDietaryOptions.length === 0 && selectedIngredients.length === 0)
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading && <Loader2 className="animate-spin" size={16} />}
            Get Substitutions
          </button>
        </div>
      </div>
    </div>
  );
}