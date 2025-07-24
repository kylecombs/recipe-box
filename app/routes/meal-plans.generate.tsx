import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import { requireUserId } from "~/utils/auth.server";
import { db } from "~/utils/db.server";
import { generateMealPlan, checkMealPlannerHealth } from "~/utils/meal-planner.server";
import { useState, useEffect } from "react";
import { areIngredientsEqual, combineQuantities, getCanonicalIngredientName } from "~/utils/ingredient-matcher.server";
import GroceryListModal from "~/components/GroceryListModal";
import Toast from "~/components/Toast";
import { ShoppingCart } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  
  // Get all user's recipes through UserRecipe associations
  const userRecipes = await db.userRecipe.findMany({
    where: { userId },
    include: {
      recipe: {
        include: {
          ingredients: true,
          tags: {
            include: {
              tag: true,
            },
          },
        },
      },
    },
    orderBy: { importedAt: "desc" },
  });

  const recipes = userRecipes.map(ur => ({
    ...ur.recipe,
    hasUpdates: ur.hasUpdates,
  }));
  
  // Get user's grocery lists
  const groceryLists = await db.groceryList.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  // Check if meal planner service is available
  const isServiceAvailable = await checkMealPlannerHealth();

  return json({ recipes, groceryLists, isServiceAvailable });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  
  const intent = formData.get("intent");
  
  if (intent === "generate") {
    const selectedRecipeIds = formData.getAll("recipeIds[]") as string[];
    
    const days = Number(formData.get("days") || 7);
    const preferences = JSON.parse(formData.get("preferences") as string || "{}");

    // Check if any recipes were selected
    if (selectedRecipeIds.length === 0) {
      return json({ success: false, error: "Please select at least one recipe" }, { status: 400 });
    }

  // Get selected recipes with full details
  const recipes = await db.recipe.findMany({
    where: {
      userId,
      id: { in: selectedRecipeIds },
    },
    include: {
      ingredients: true,
      tags: {
        include: {
          tag: true,
        },
      },
    },
  });

  // Transform recipes to the format expected by the meal planner service
  const recipesForPlanning = recipes.map(recipe => ({
    id: recipe.id,
    title: recipe.title,
    ingredients: recipe.ingredients
      .map(ing => ing.original || ing.name),
    instructions: recipe.instructions || "",
    servings: recipe.servings || 4,
    cookTime: recipe.cookTime || 0,
    prepTime: recipe.prepTime || 0,
    tags: recipe.tags
      .map(rt => rt.tag.name),
  }));

  try {
    const mealPlan = await generateMealPlan({
      recipes: recipesForPlanning,
      days,
      preferences,
    });

    return json({ success: true, mealPlan });
  } catch (error: any) {
    console.error("Meal plan generation error:", error);
    return json({ success: false, error: error?.message || "Failed to generate meal plan" }, { status: 500 });
  }
  }
  
  if (intent === "save") {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const mealPlan = JSON.parse(formData.get("mealPlan") as string);
    
    try {
      const savedPlan = await db.mealPlan.create({
        data: {
          name,
          description,
          days: mealPlan.week.length,
          weekPlan: mealPlan.week,
          shoppingList: mealPlan.shopping_list,
          notes: mealPlan.notes,
          userId,
        },
      });
      
      return json({ success: true, saved: true, savedPlanId: savedPlan.id });
    } catch (error: any) {
      console.error("Meal plan save error:", error);
      return json({ success: false, error: "Failed to save meal plan" }, { status: 500 });
    }
  }
  
  if (intent === "addToGroceryList") {
    const groceryListId = formData.get("groceryListId") as string;
    const newListName = formData.get("newListName") as string;
    const items = JSON.parse(formData.get("items") as string);
    
    try {
      let targetGroceryListId = groceryListId;
      
      // Create new grocery list if name is provided
      if (newListName?.trim()) {
        const newList = await db.groceryList.create({
          data: {
            name: newListName.trim(),
            userId,
          },
        });
        targetGroceryListId = newList.id;
      }
      
      if (!targetGroceryListId) {
        return json({ success: false, error: "No grocery list selected or created" }, { status: 400 });
      }
      
      // Get existing items in the grocery list
      const existingItems = await db.groceryListItem.findMany({
        where: { groceryListId: targetGroceryListId },
      });
      
      // Process new items and combine with existing ones
      const itemsToCreate = [];
      const itemsToUpdate = [];
      
      for (const newItem of items) {
        const existingItem = existingItems.find(existing => 
          areIngredientsEqual(existing.name, newItem.item)
        );
        
        if (existingItem) {
          // Combine quantities
          const combinedQuantity = combineQuantities(
            existingItem.quantity || "",
            existingItem.unit || "",
            newItem.quantity || "",
            newItem.unit || ""
          );
          
          // Truncate to safe lengths for MySQL VARCHAR(255)
          const truncatedQuantity = combinedQuantity.quantity ? combinedQuantity.quantity.substring(0, 200) : null;
          const truncatedUnit = combinedQuantity.unit ? combinedQuantity.unit.substring(0, 80) : null;
          
          itemsToUpdate.push({
            id: existingItem.id,
            quantity: truncatedQuantity,
            unit: truncatedUnit,
          });
        } else {
          // Truncate to safe lengths for MySQL VARCHAR(255)
          const truncatedQuantity = newItem.quantity ? newItem.quantity.substring(0, 200) : "";
          const truncatedUnit = newItem.unit ? newItem.unit.substring(0, 80) : "";
          
          itemsToCreate.push({
            name: newItem.item,
            quantity: truncatedQuantity,
            unit: truncatedUnit,
            groceryListId: targetGroceryListId,
          });
        }
      }
      
      // Execute updates and creates
      await Promise.all([
        ...itemsToUpdate.map(item => 
          db.groceryListItem.update({
            where: { id: item.id },
            data: { quantity: item.quantity, unit: item.unit },
          })
        ),
        ...(itemsToCreate.length > 0 ? [db.groceryListItem.createMany({
          data: itemsToCreate,
        })] : []),
      ]);
      
      return json({ success: true, addedToList: true });
    } catch (error: any) {
      console.error("Add to grocery list error:", error);
      return json({ success: false, error: "Failed to add items to grocery list" }, { status: 500 });
    }
  }
  
  return json({ success: false, error: "Invalid action" }, { status: 400 });
}

export default function MealPlan() {
  const { recipes, groceryLists, isServiceAvailable } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [selectedRecipes, setSelectedRecipes] = useState<string[]>([]);
  const [days, setDays] = useState(7);
  const [preferences, setPreferences] = useState({
    dietaryRestrictions: "",
    avoidIngredients: "",
    preferredCuisines: "",
  });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planDescription, setPlanDescription] = useState("");
  const [showGroceryListModal, setShowGroceryListModal] = useState(false);
  const [selectedGroceryListId, setSelectedGroceryListId] = useState("");
  const [newGroceryListName, setNewGroceryListName] = useState("");
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleRecipeToggle = (recipeId: string) => {
    setSelectedRecipes(prev =>
      prev.includes(recipeId)
        ? prev.filter(id => id !== recipeId)
        : [...prev, recipeId]
    );
  };

  const handleGenerateMealPlan = () => {
    const formData = new FormData();
    formData.append("intent", "generate");
    selectedRecipes.forEach(id => formData.append("recipeIds[]", id));
    formData.append("days", days.toString());
    formData.append("preferences", JSON.stringify(preferences));
    fetcher.submit(formData, { method: "post" });
  };
  
  const handleSaveMealPlan = () => {
    if (!planName.trim()) {
      alert("Please enter a name for your meal plan");
      return;
    }
    
    const formData = new FormData();
    formData.append("intent", "save");
    formData.append("name", planName);
    formData.append("description", planDescription);
    formData.append("mealPlan", JSON.stringify(mealPlan));
    fetcher.submit(formData, { method: "post" });
    setShowSaveModal(false);
  };
  
  const isGenerating = fetcher.state === "submitting";
  const mealPlan = fetcher.data?.success && 'mealPlan' in fetcher.data ? fetcher.data.mealPlan : null;
  const error = fetcher.data?.success === false && 'error' in fetcher.data ? fetcher.data.error : null;
  // Handle fetcher state changes
  useEffect(() => {
    // Only process when fetcher has completed a submission (not on initial load)
    if (fetcher.state === 'idle' && fetcher.data && Object.keys(fetcher.data).length > 0) {
      if (fetcher.data.success === true && fetcher.data.addedToList === true) {
        setShowGroceryListModal(false);
        setSelectedGroceryListId("");
        setNewGroceryListName("");
        setShowSuccessToast(true);
        setShowErrorToast(false);
        setErrorMessage("");
      } else if (fetcher.data.success === true && fetcher.data.saved === true) {
        setShowSavedToast(true);
        setShowErrorToast(false);
        setErrorMessage("");
      } else if (fetcher.data.success === false && fetcher.data.error) {
        setShowErrorToast(true);
        setShowSuccessToast(false);
        setShowSavedToast(false);
        setErrorMessage(fetcher.data.error);
      }
    }
  }, [fetcher.state, fetcher.data]);

  if (!isServiceAvailable) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Meal Planner</h1>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <p className="text-yellow-700">
            The meal planning service is currently unavailable. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Generate Meal Plan</h1>

      {!mealPlan && (
        <div className="space-y-6">
          {/* Recipe Selection */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Select Recipes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedRecipes.includes(recipe.id)
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                  onClick={() => handleRecipeToggle(recipe.id)}
                >
                  <h3 className="font-medium">{recipe.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {recipe.servings} servings • {(recipe.prepTime || 0) + (recipe.cookTime || 0)} min
                  </p>
                  {recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {recipe.tags.map((rt) => (
                        <span
                          key={rt.tag.id}
                          className="text-xs bg-gray-200 px-2 py-1 rounded"
                        >
                          {rt.tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Number of days
                </label>
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value={3}>3 days</option>
                  <option value={5}>5 days</option>
                  <option value={7}>7 days (1 week)</option>
                  <option value={14}>14 days (2 weeks)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Dietary Restrictions
                </label>
                <input
                  type="text"
                  placeholder="e.g., vegetarian, gluten-free"
                  value={preferences.dietaryRestrictions}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      dietaryRestrictions: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Ingredients to Avoid
                </label>
                <input
                  type="text"
                  placeholder="e.g., nuts, shellfish"
                  value={preferences.avoidIngredients}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      avoidIngredients: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Preferred Cuisines
                </label>
                <input
                  type="text"
                  placeholder="e.g., Italian, Mexican"
                  value={preferences.preferredCuisines}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      preferredCuisines: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <div>
            <button
              onClick={handleGenerateMealPlan}
              disabled={selectedRecipes.length === 0 || isGenerating}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isGenerating ? "Generating..." : "Generate Meal Plan"}
            </button>
            {selectedRecipes.length === 0 && (
              <p className="text-sm text-gray-600 mt-2">
                Please select at least one recipe
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Meal Plan Display */}
      {mealPlan && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <button
              onClick={() => window.location.reload()}
              className="text-blue-600 hover:text-blue-700"
            >
              ← Generate Another Plan
            </button>
            
            <div className="flex gap-4">
              <button
                onClick={() => setShowSaveModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Save Meal Plan
              </button>
              
              <button
                onClick={() => setShowGroceryListModal(true)}
                className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                <ShoppingCart size={16} className="mr-2" />
                Add to Grocery List
              </button>
            </div>
          </div>
          
          <Toast
            message="Meal plan saved successfully!"
            type="success"
            show={showSavedToast}
            onClose={() => setShowSavedToast(false)}
          />
          
          <Toast
            message="Items added to grocery list successfully!"
            type="success"
            show={showSuccessToast}
            onClose={() => setShowSuccessToast(false)}
          />
          
          <Toast
            message={errorMessage || "Failed to add items to grocery list"}
            type="error"
            show={showErrorToast}
            onClose={() => setShowErrorToast(false)}
          />

          <div>
            <h2 className="text-2xl font-semibold mb-4">Your Meal Plan</h2>
            
            {/* Week Plan */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {mealPlan.week.map((day: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3">{day.day}</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium text-sm">Breakfast:</span>
                      {day.breakfast.recipeId ? (
                        <Link
                          to={`/recipes/${day.breakfast.recipeId}`}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {day.breakfast.recipe}
                        </Link>
                      ) : (
                        <p className="text-sm">{day.breakfast.recipe}</p>
                      )}
                      {day.breakfast.notes && (
                        <p className="text-xs text-gray-600">{day.breakfast.notes}</p>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-sm">Lunch:</span>
                      {day.lunch.recipeId ? (
                        <Link
                          to={`/recipes/${day.lunch.recipeId}`}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {day.lunch.recipe}
                        </Link>
                      ) : (
                        <p className="text-sm">{day.lunch.recipe}</p>
                      )}
                      {day.lunch.notes && (
                        <p className="text-xs text-gray-600">{day.lunch.notes}</p>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-sm">Dinner:</span>
                      {day.dinner.recipeId ? (
                        <Link
                          to={`/recipes/${day.dinner.recipeId}`}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {day.dinner.recipe}
                        </Link>
                      ) : (
                        <p className="text-sm">{day.dinner.recipe}</p>
                      )}
                      {day.dinner.notes && (
                        <p className="text-xs text-gray-600">{day.dinner.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Shopping List */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg">Shopping List</h3>
                <button
                  onClick={() => setShowGroceryListModal(true)}
                  className="inline-flex items-center px-3 py-1 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700"
                >
                  <ShoppingCart size={14} className="mr-1" />
                  Add to Grocery List
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {mealPlan.shopping_list.map((item: any, index: number) => (
                  <div key={index} className="flex items-center">
                    <input type="checkbox" className="mr-2" />
                    <span className="text-sm">
                      {item.quantity} {item.unit} {item.item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {mealPlan.notes && (
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-2">Tips</h3>
                <p className="text-sm">{mealPlan.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Grocery List Modal */}
      <GroceryListModal
        isOpen={showGroceryListModal}
        onClose={() => {
          setShowGroceryListModal(false);
          setSelectedGroceryListId("");
          setNewGroceryListName("");
        }}
        groceryLists={groceryLists}
        selectedGroceryListId={selectedGroceryListId}
        setSelectedGroceryListId={setSelectedGroceryListId}
        newGroceryListName={newGroceryListName}
        setNewGroceryListName={setNewGroceryListName}
        itemCount={mealPlan?.shopping_list?.length || 0}
        itemDescription="ingredients"
        actionIntent="addToGroceryList"
        fetcher={fetcher}
        additionalInputs={
          <input
            type="hidden"
            name="items"
            value={JSON.stringify(mealPlan?.shopping_list || [])}
          />
        }
      />
      
      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Save Meal Plan</h3>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="plan-name" className="block text-sm font-medium mb-1">
                  Plan Name
                </label>
                <input
                  id="plan-name"
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="e.g., Week 1 Healthy Meals"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  autoFocus
                />
              </div>
              
              <div>
                <label htmlFor="plan-description" className="block text-sm font-medium mb-1">
                  Description (optional)
                </label>
                <textarea
                  id="plan-description"
                  value={planDescription}
                  onChange={(e) => setPlanDescription(e.target.value)}
                  placeholder="Add any notes about this meal plan..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMealPlan}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Save Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}