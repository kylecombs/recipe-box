import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useFetcher } from "@remix-run/react";
import { ArrowLeft, ShoppingCart, Edit } from "lucide-react";
import { requireUserId } from "~/utils/auth.server";
import { db } from "~/utils/db.server";
import { areIngredientsEqual, combineQuantities } from "~/utils/ingredient-matcher.server";
import GroceryListModal from "~/components/GroceryListModal";
import Toast from "~/components/Toast";
import { useState, useEffect } from "react";

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
  
  // Get user's grocery lists
  const groceryLists = await db.groceryList.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  
  return json({ mealPlan, groceryLists });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  
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

export default function MealPlanDetail() {
  const { mealPlan, groceryLists } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [showGroceryListModal, setShowGroceryListModal] = useState(false);
  const [selectedGroceryListId, setSelectedGroceryListId] = useState("");
  const [newGroceryListName, setNewGroceryListName] = useState("");
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  // Parse the JSON fields
  const weekPlan = mealPlan.weekPlan as any[];
  const shoppingList = mealPlan.shoppingList as any[];
  
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
      } else if (fetcher.data.success === false && fetcher.data.error) {
        setShowErrorToast(true);
        setShowSuccessToast(false);
        setErrorMessage(fetcher.data.error);
      }
    }
  }, [fetcher.state, fetcher.data]);
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Link
          to="/meal-plans"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft size={20} className="mr-1" />
          Back to Meal Plans
        </Link>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{mealPlan.name}</h1>
            {mealPlan.description && (
              <p className="text-gray-600 mt-2">{mealPlan.description}</p>
            )}
            <p className="text-sm text-gray-500 mt-1">
              Created on {new Date(mealPlan.createdAt).toLocaleDateString()}
            </p>
          </div>
          <Link
            to={`/meal-plans/edit/${mealPlan.id}`}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Edit size={16} className="mr-2" />
            Edit Plan
          </Link>
        </div>
      </div>
      
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
      
      {/* Week Plan */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Weekly Meal Plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {weekPlan.map((day: any, index: number) => (
            <div key={index} className="border rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3">{day.day}</h3>
              <div className="space-y-2">
                <div>
                  <span className="font-medium text-sm">Breakfast:</span>
                  <p className="text-sm">{day.breakfast.recipe}</p>
                  {day.breakfast.notes && (
                    <p className="text-xs text-gray-600">{day.breakfast.notes}</p>
                  )}
                </div>
                <div>
                  <span className="font-medium text-sm">Lunch:</span>
                  <p className="text-sm">{day.lunch.recipe}</p>
                  {day.lunch.notes && (
                    <p className="text-xs text-gray-600">{day.lunch.notes}</p>
                  )}
                </div>
                <div>
                  <span className="font-medium text-sm">Dinner:</span>
                  <p className="text-sm">{day.dinner.recipe}</p>
                  {day.dinner.notes && (
                    <p className="text-xs text-gray-600">{day.dinner.notes}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Shopping List */}
      <div className="bg-gray-50 rounded-lg p-6 mb-8">
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
          {shoppingList.map((item: any, index: number) => (
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
      
      {/* Grocery List Modal */}
      <GroceryListModal
        isOpen={showGroceryListModal}
        onClose={() => {
          setShowGroceryListModal(false);
        }}
        groceryLists={groceryLists}
        selectedGroceryListId={selectedGroceryListId}
        setSelectedGroceryListId={setSelectedGroceryListId}
        newGroceryListName={newGroceryListName}
        setNewGroceryListName={setNewGroceryListName}
        itemCount={shoppingList.length}
        itemDescription="ingredients"
        actionIntent="addToGroceryList"
        fetcher={fetcher}
        additionalInputs={
          <input
            type="hidden"
            name="items"
            value={JSON.stringify(shoppingList)}
          />
        }
      />
    </div>
  );
}