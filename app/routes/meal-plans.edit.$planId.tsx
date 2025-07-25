import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, Form, useActionData, useNavigation } from "@remix-run/react";
import { RecipeCombobox } from "~/components/RecipeCombobox";
import { Save, Calendar, Plus, Minus } from "lucide-react";
import { requireUserId } from "~/utils/auth.server";
import { db } from "~/utils/db.server";
import { useState } from "react";

type ActionData = {
  error?: string;
  success?: boolean;
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const { planId } = params;
  
  const mealPlan = await db.mealPlan.findUnique({
    where: {
      id: planId,
      userId, // Ensure user owns this plan
    },
  });
  
  if (!mealPlan) {
    throw new Response("Meal plan not found", { status: 404 });
  }
  
  // Get user's recipes
  const userRecipes = await db.userRecipe.findMany({
    where: { userId },
    include: {
      recipe: {
        select: {
          id: true,
          title: true,
          servings: true,
          prepTime: true,
          cookTime: true,
        },
      },
    },
    orderBy: { importedAt: "desc" },
  });

  const recipes = userRecipes.map(ur => ur.recipe);
  
  return json({ mealPlan, recipes });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const { planId } = params;
  const formData = await request.formData();
  
  // Verify ownership
  const existingPlan = await db.mealPlan.findUnique({
    where: { id: planId, userId },
  });
  
  if (!existingPlan) {
    return json({ error: "Meal plan not found" }, { status: 404 });
  }
  
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const notes = formData.get("notes") as string;
  const weekPlanData = formData.get("weekPlan") as string;
  const shoppingListData = formData.get("shoppingList") as string;
  
  if (!name?.trim()) {
    return json({ error: "Name is required" }, { status: 400 });
  }
  
  try {
    const weekPlan = JSON.parse(weekPlanData);
    const shoppingList = JSON.parse(shoppingListData);
    
    await db.mealPlan.update({
      where: { id: planId },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        notes: notes?.trim() || null,
        days: weekPlan.length,
        weekPlan,
        shoppingList,
      },
    });
    
    return redirect(`/meal-plans/${planId}`);
  } catch (error) {
    console.error("Error updating meal plan:", error);
    return json({ error: "Failed to update meal plan" }, { status: 500 });
  }
}

export default function EditMealPlan() {
  const { mealPlan, recipes } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const isSubmitting = navigation.state === "submitting";
  
  // Define types for meal plan data
  type MealPlanDay = {
    day: string;
    breakfast: { recipe: string; recipeId?: string; notes?: string };
    lunch: { recipe: string; recipeId?: string; notes?: string };
    dinner: { recipe: string; recipeId?: string; notes?: string };
  };
  
  type ShoppingListItem = {
    item: string;
    quantity: string;
    unit: string;
  };
  
  // Parse the JSON fields
  const initialWeekPlan = mealPlan.weekPlan as MealPlanDay[];
  const initialShoppingList = mealPlan.shoppingList as ShoppingListItem[];
  
  // State for form fields
  const [name, setName] = useState(mealPlan.name);
  const [description, setDescription] = useState(mealPlan.description || "");
  const [notes, setNotes] = useState(mealPlan.notes || "");
  const [weekPlan, setWeekPlan] = useState(initialWeekPlan);
  const [shoppingList, setShoppingList] = useState(initialShoppingList);
  
  const handleDayChange = (dayIndex: number, field: string, value: string, recipeId?: string) => {
    setWeekPlan(prev => prev.map((day, index) => {
      if (index === dayIndex) {
        const [mealType, subField] = field.split('.');
        const mealTypeKey = mealType as keyof Pick<MealPlanDay, 'breakfast' | 'lunch' | 'dinner'>;
        
        if (subField === 'recipe') {
          return {
            ...day,
            [mealTypeKey]: {
              ...day[mealTypeKey],
              recipe: value,
              recipeId: recipeId || undefined,
            },
          };
        } else {
          return {
            ...day,
            [mealTypeKey]: {
              ...day[mealTypeKey],
              [subField]: value,
            },
          };
        }
      }
      return day;
    }));
  };
  
  const handleShoppingItemChange = (itemIndex: number, field: string, value: string) => {
    setShoppingList(prev => prev.map((item, index) => {
      if (index === itemIndex) {
        const fieldKey = field as keyof ShoppingListItem;
        return { ...item, [fieldKey]: value };
      }
      return item;
    }));
  };
  
  const addShoppingItem = () => {
    setShoppingList(prev => [...prev, { item: "", quantity: "", unit: "" }]);
  };
  
  const removeShoppingItem = (itemIndex: number) => {
    setShoppingList(prev => prev.filter((_, index) => index !== itemIndex));
  };
  
  const addDay = () => {
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const nextDayName = dayNames[weekPlan.length % dayNames.length];
    
    setWeekPlan(prev => [...prev, {
      day: nextDayName,
      breakfast: { recipe: "", notes: "" },
      lunch: { recipe: "", notes: "" },
      dinner: { recipe: "", notes: "" },
    }]);
  };
  
  const removeDay = (dayIndex: number) => {
    if (weekPlan.length > 1) {
      setWeekPlan(prev => prev.filter((_, index) => index !== dayIndex));
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center">
          <Calendar className="mr-3" size={32} />
          Edit Meal Plan
        </h1>
      </div>
      
      <Form method="post" className="space-y-8">
        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Plan Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Week 1 Healthy Meals"
              />
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add a description for this meal plan..."
              />
            </div>
            
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes & Tips
              </label>
              <textarea
                id="notes"
                name="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add any cooking tips or notes..."
              />
            </div>
          </div>
        </div>
        
        {/* Weekly Meal Plan */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Weekly Meal Plan</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addDay}
                className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                <Plus size={16} className="mr-1" />
                Add Day
              </button>
            </div>
          </div>
          
          <div className="space-y-6">
            {weekPlan.map((day, dayIndex) => (
              <div key={dayIndex} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">{day.day}</h3>
                  {weekPlan.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDay(dayIndex)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Minus size={20} />
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(['breakfast', 'lunch', 'dinner'] as const).map((mealType) => (
                    <div key={mealType} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 capitalize">
                        {mealType}
                      </label>
                      <RecipeCombobox
                        recipes={recipes}
                        value={day[mealType].recipe}
                        onChange={(value, recipeId) => handleDayChange(dayIndex, `${mealType}.recipe`, value, recipeId)}
                        placeholder={`${mealType.charAt(0).toUpperCase() + mealType.slice(1)} recipe`}
                        className="w-full"
                      />
                      <input
                        type="text"
                        value={day[mealType].notes || ""}
                        onChange={(e) => handleDayChange(dayIndex, `${mealType}.notes`, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Notes (optional)"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Shopping List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Shopping List</h2>
            <button
              type="button"
              onClick={addShoppingItem}
              className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Plus size={16} className="mr-1" />
              Add Item
            </button>
          </div>
          
          <div className="space-y-3">
            {shoppingList.map((item, itemIndex) => (
              <div key={itemIndex} className="flex gap-3 items-center">
                <input
                  type="text"
                  value={item.quantity}
                  onChange={(e) => handleShoppingItemChange(itemIndex, 'quantity', e.target.value)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Qty"
                />
                <input
                  type="text"
                  value={item.unit}
                  onChange={(e) => handleShoppingItemChange(itemIndex, 'unit', e.target.value)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Unit"
                />
                <input
                  type="text"
                  value={item.item}
                  onChange={(e) => handleShoppingItemChange(itemIndex, 'item', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Item name"
                />
                <button
                  type="button"
                  onClick={() => removeShoppingItem(itemIndex)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Minus size={20} />
                </button>
              </div>
            ))}
          </div>
        </div>
        
        {actionData?.error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-red-700">{actionData.error}</p>
          </div>
        )}
        
        {/* Hidden inputs for JSON data */}
        <input type="hidden" name="weekPlan" value={JSON.stringify(weekPlan)} />
        <input type="hidden" name="shoppingList" value={JSON.stringify(shoppingList)} />
        
        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(`/meal-plans/${mealPlan.id}`)}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            <Save size={20} className="mr-2" />
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </Form>
    </div>
  );
}