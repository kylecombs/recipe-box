import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Plus } from "lucide-react";

interface Recipe {
  id: string;
  title: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
}

interface RecipeComboboxProps {
  recipes: Recipe[];
  value: string;
  onChange: (value: string, recipeId?: string) => void;
  placeholder?: string;
  className?: string;
}

export function RecipeCombobox({
  recipes,
  value,
  onChange,
  placeholder = "Search recipes or enter custom text...",
  className = "",
}: RecipeComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter recipes based on search term
  const filteredRecipes = recipes.filter((recipe) =>
    recipe.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle clicks outside component
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSearchTerm(newValue);
    setIsOpen(true);
    
    // If the input matches exactly a recipe title, pass the recipe ID
    const matchingRecipe = recipes.find(
      (recipe) => recipe.title.toLowerCase() === newValue.toLowerCase()
    );
    
    onChange(newValue, matchingRecipe?.id);
  };

  const handleRecipeSelect = (recipe: Recipe) => {
    setInputValue(recipe.title);
    setSearchTerm("");
    setIsOpen(false);
    onChange(recipe.title, recipe.id);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    setSearchTerm(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchTerm("");
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown" && filteredRecipes.length > 0) {
      e.preventDefault();
      // Could implement keyboard navigation here
    }
  };

  const addCustomText = () => {
    setIsOpen(false);
    setSearchTerm("");
    onChange(inputValue); // No recipe ID for custom text
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {/* Search header */}
          {searchTerm && (
            <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-3 py-2">
              <div className="flex items-center text-sm text-gray-600">
                <Search className="h-4 w-4 mr-2" />
                <span>Searching for &quot;{searchTerm}&quot;</span>
              </div>
            </div>
          )}

          {/* Recipe results */}
          {filteredRecipes.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-50">
                Your Recipes
              </div>
              {filteredRecipes.slice(0, 10).map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => handleRecipeSelect(recipe)}
                  className="w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                >
                  <div className="font-medium text-sm text-gray-900">{recipe.title}</div>
                  <div className="text-xs text-gray-500">
                    {recipe.servings && `${recipe.servings} servings`}
                    {recipe.servings && ((recipe.prepTime || 0) + (recipe.cookTime || 0)) > 0 && " • "}
                    {((recipe.prepTime || 0) + (recipe.cookTime || 0)) > 0 && 
                      `${(recipe.prepTime || 0) + (recipe.cookTime || 0)} min`
                    }
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Custom text option */}
          {searchTerm && (
            <div className="border-t border-gray-200 py-1">
              <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-50">
                Custom Entry
              </div>
              <button
                type="button"
                onClick={addCustomText}
                className="w-full px-3 py-2 text-left hover:bg-green-50 focus:bg-green-50 focus:outline-none"
              >
                <div className="flex items-center text-sm text-gray-900">
                  <Plus className="h-4 w-4 mr-2 text-green-600" />
                  <span>Add &quot;{searchTerm}&quot; as custom text</span>
                </div>
                <div className="text-xs text-gray-500 ml-6">
                  This won&apos;t link to a recipe
                </div>
              </button>
            </div>
          )}

          {/* No results */}
          {filteredRecipes.length === 0 && !searchTerm && (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">
              Start typing to search your recipes
            </div>
          )}

          {filteredRecipes.length === 0 && searchTerm && (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">
              No recipes found for &quot;{searchTerm}&quot;
              <br />
              Use the custom entry option above
            </div>
          )}
        </div>
      )}
    </div>
  );
}