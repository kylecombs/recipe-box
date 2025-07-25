import { X, Save, FileText, Loader2 } from "lucide-react";
import type { Ingredient } from "@prisma/client";

interface RecipePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalRecipe: {
    title: string;
    description?: string | null;
    instructions?: string | null;
    prepTime?: number | null;
    cookTime?: number | null;
    servings?: number | null;
  };
  substitutedRecipe: {
    title: string;
    description?: string;
    instructions: string;
    ingredients: Array<{
      name: string;
      quantity?: string;
      unit?: string;
    }>;
    substitutionNotes: string;
  };
  onOverwrite: () => void;
  onSaveAsNew: () => void;
  isSaving?: boolean;
}

export default function RecipePreviewModal({
  isOpen,
  onClose,
  originalRecipe,
  substitutedRecipe,
  onOverwrite,
  onSaveAsNew,
  isSaving = false,
}: RecipePreviewModalProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSaving) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h2 className="text-xl font-semibold">Recipe Preview</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            disabled={isSaving}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Title */}
          <h1 className="text-2xl font-bold mb-4">{substitutedRecipe.title}</h1>

          {/* Description */}
          {substitutedRecipe.description && (
            <p className="text-gray-600 mb-4">{substitutedRecipe.description}</p>
          )}

          {/* Substitution Notes */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Substitution Notes</h3>
            <div className="text-blue-800 whitespace-pre-wrap">{substitutedRecipe.substitutionNotes}</div>
          </div>

          {/* Recipe Details */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Ingredients */}
            <div>
              <h3 className="font-semibold text-lg mb-3">Ingredients</h3>
              <ul className="space-y-2">
                {substitutedRecipe.ingredients.map((ingredient, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-gray-400 mr-2">•</span>
                    <span>
                      {ingredient.quantity && <span className="font-medium">{ingredient.quantity} </span>}
                      {ingredient.unit && <span className="font-medium">{ingredient.unit} </span>}
                      {ingredient.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Instructions */}
            <div>
              <h3 className="font-semibold text-lg mb-3">Instructions</h3>
              <div className="space-y-3">
                {substitutedRecipe.instructions.split('\n').filter(step => step.trim()).map((step, index) => (
                  <div key={index} className="flex">
                    <span className="font-medium text-gray-500 mr-3 mt-0.5">{index + 1}.</span>
                    <p className="flex-1 text-gray-700">{step.trim()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Meta Information */}
          <div className="mt-6 pt-6 border-t flex flex-wrap gap-4 text-sm text-gray-600">
            {originalRecipe.prepTime && (
              <div>
                <span className="font-medium">Prep Time:</span> {originalRecipe.prepTime} minutes
              </div>
            )}
            {originalRecipe.cookTime && (
              <div>
                <span className="font-medium">Cook Time:</span> {originalRecipe.cookTime} minutes
              </div>
            )}
            {originalRecipe.servings && (
              <div>
                <span className="font-medium">Servings:</span> {originalRecipe.servings}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-between items-center bg-gray-50">
          <div className="text-sm text-gray-600">
            Review the substituted recipe before saving
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={onOverwrite}
              disabled={isSaving}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSaving && <Loader2 className="animate-spin" size={16} />}
              <FileText size={16} />
              Overwrite Current Recipe
            </button>
            <button
              onClick={onSaveAsNew}
              disabled={isSaving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSaving && <Loader2 className="animate-spin" size={16} />}
              <Save size={16} />
              Save as New Recipe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}