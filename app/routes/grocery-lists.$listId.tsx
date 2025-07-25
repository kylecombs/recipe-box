import { json, LoaderFunctionArgs, ActionFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation } from "@remix-run/react";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { db } from "~/utils/db.server";
import { requireUserId } from "~/utils/auth.server";
import Toast from "~/components/Toast";
import GroceryListView from "~/components/GroceryListView";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const listId = params.listId;

  if (!listId) {
    throw new Response("Grocery list not found", { status: 404 });
  }

  let groceryList = await db.groceryList.findFirst({
    where: { id: listId, userId },
    include: {
      items: true
    }
  });

  if (!groceryList) {
    throw new Response("Grocery list not found", { status: 404 });
  }

  // remove pantry staples
  const saltPepperVariants = [
    'salt', 'pepper', 'black pepper', 'white pepper', 'sea salt', 'kosher salt', 'table salt',
    'freshly ground pepper', 'freshly ground black pepper', 'ground pepper', 'ground black pepper',
    'cracked pepper', 'cracked black pepper', 'fine salt', 'coarse salt', 'rock salt'
  ];
  
  const needsFixing = groceryList.items?.some(item => 
    (item.unit === 'garlic' && (item.name.includes('cloves') || item.name.includes('clove'))) ||
    item.name.endsWith(',') || item.name.endsWith(', ,') || item.name.includes(', ,') ||
    item.name.startsWith('-virgin') || item.name.includes('-virgin olive oil') ||
    item.name.match(/^[^,]+,\s*(?:about\s+)?\d+(?:\s*\/\s*\d+|\s+\d+\/\d+)?\s*(?:cups?|pounds?|ounces?|tablespoons?|teaspoons?|cloves?|pieces?|heads?|bunches?|sprigs?|leaves?|large|medium|small)(?:\s+.*)?$/i) ||
    saltPepperVariants.some(variant => 
      item.name.toLowerCase() === variant || 
      item.name.toLowerCase().includes(variant) ||
      (item.notes && item.notes.toLowerCase().includes(variant))
    )
  );

  if (needsFixing) {
    const fixedItems = groceryList.items?.filter(item => {
      // Remove salt and pepper items
      if (saltPepperVariants.some(variant => 
        item.name.toLowerCase() === variant || 
        item.name.toLowerCase().includes(variant) ||
        (item.notes && item.notes.toLowerCase().includes(variant))
      )) {
        return false;
      }
      return true;
    }).map(item => {
      let fixedItem = { ...item };
      
      // Fix corrupted garlic entries
      if (item.unit === 'garlic' && (item.name.includes('cloves') || item.name.includes('clove'))) {
        fixedItem = {
          ...item,
          name: 'garlic',
          unit: item.quantity && parseInt(item.quantity) === 1 ? 'clove' : 'cloves',
          notes: item.notes || null,
          updatedAt: new Date()
        };
      }
      
      // Fix stray commas in names
      if (fixedItem.name.endsWith(',') || fixedItem.name.endsWith(', ,') || fixedItem.name.includes(', ,')) {
        fixedItem.name = fixedItem.name
          .replace(/,\s*$/, '') // Remove trailing commas
          .replace(/^\s*,/, '') // Remove leading commas
          .replace(/,\s*,/g, ',') // Fix double commas
          .replace(/\s*,\s*$/, '') // Remove trailing comma with spaces
          .trim();
        fixedItem.updatedAt = new Date();
      }
      
      // Fix ingredient entries that include quantity in the name (e.g., "basil, 2 cups" or "ricotta, 1 cup")
      const quantityInNameMatch = fixedItem.name.match(/^([^,]+),\s*(?:about\s+)?\d+(?:\s*\/\s*\d+|\s+\d+\/\d+)?\s*(?:cups?|pounds?|ounces?|tablespoons?|teaspoons?|cloves?|pieces?|heads?|bunches?|sprigs?|leaves?|large|medium|small)(?:\s+.*)?$/i);
      if (quantityInNameMatch) {
        fixedItem.name = quantityInNameMatch[1].trim();
        fixedItem.updatedAt = new Date();
      }
      
      // Special case for parmesan mixture
      if (fixedItem.name.toLowerCase().includes('parmesan') && 
          fixedItem.name.toLowerCase().includes('pecorino') &&
          (fixedItem.notes && fixedItem.notes.toLowerCase().includes('mixture'))) {
        fixedItem.name = 'parmesan, pecorino or a mixture';
        fixedItem.updatedAt = new Date();
      }
      
      // Fix corrupted olive oil names
      if (fixedItem.name.startsWith('-virgin') || fixedItem.name.includes('-virgin olive oil')) {
        // Check if we have original name in notes
        if (fixedItem.notes && fixedItem.notes.startsWith('Original: ')) {
          const originalName = fixedItem.notes.substring(10);
          if (originalName.toLowerCase().includes('extra-virgin') || originalName.toLowerCase().includes('extra virgin')) {
            fixedItem.name = 'olive oil'; // Use canonical name
          }
        } else {
          // Default fix for corrupted olive oil
          fixedItem.name = 'olive oil';
        }
        fixedItem.updatedAt = new Date();
      }
      
      return fixedItem;
    }) || [];

    // Update the database with fixed data - need to delete and recreate items
    await db.groceryListItem.deleteMany({
      where: { groceryListId: listId }
    });
    
    await db.groceryListItem.createMany({
      data: fixedItems.map(item => ({
        ...item,
        groceryListId: listId
      }))
    });
    
    // Fetch updated grocery list
    groceryList = await db.groceryList.findFirst({
      where: { id: listId, userId },
      include: {
        items: true
      }
    });
  }

  return json({ groceryList });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const listId = params.listId;

  if (!listId) {
    throw new Response("Grocery list not found", { status: 404 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "toggleItem") {
    const itemId = formData.get("itemId")?.toString();
    
    try {
      const groceryList = await db.groceryList.findFirst({
        where: { id: listId, userId },
        include: {
          items: true
        }
      });

      if (!groceryList) {
        throw new Response("Grocery list not found", { status: 404 });
      }

      await db.groceryListItem.update({
        where: { id: itemId },
        data: { 
          checked: !groceryList.items.find(item => item.id === itemId)?.checked
        }
      });

      return json({ success: true });
    } catch (error) {
      console.error("Error toggling item:", error);
      return json({ error: "Failed to toggle item" }, { status: 500 });
    }
  }

  if (intent === "addItem") {
    const name = formData.get("name")?.toString();
    const quantity = formData.get("quantity")?.toString();
    const unit = formData.get("unit")?.toString();
    
    if (!name?.trim()) {
      return json({ error: "Item name is required" }, { status: 400 });
    }

    try {
      const groceryList = await db.groceryList.findFirst({
        where: { id: listId, userId },
        include: {
          items: true
        }
      });

      if (!groceryList) {
        throw new Response("Grocery list not found", { status: 404 });
      }

      await db.groceryListItem.create({
        data: {
          name: name.trim(),
          quantity: quantity?.trim() || null,
          unit: unit?.trim() || null,
          notes: null,
          checked: false,
          groceryListId: listId
        }
      });

      return json({ success: true, addedItem: true });
    } catch (error) {
      console.error("Error adding item:", error);
      return json({ error: "Failed to add item" }, { status: 500 });
    }
  }

  if (intent === "editItem") {
    const itemId = formData.get("itemId")?.toString();
    const name = formData.get("name")?.toString();
    const quantity = formData.get("quantity")?.toString();
    const unit = formData.get("unit")?.toString();
    
    if (!itemId || !name?.trim()) {
      return json({ error: "Item ID and name are required" }, { status: 400 });
    }

    try {
      const groceryList = await db.groceryList.findFirst({
        where: { id: listId, userId },
        include: {
          items: true
        }
      });

      if (!groceryList) {
        throw new Response("Grocery list not found", { status: 404 });
      }

      await db.groceryListItem.update({
        where: { id: itemId },
        data: {
          name: name.trim(),
          quantity: quantity?.trim() || null,
          unit: unit?.trim() || null
        }
      });

      return json({ success: true, editedItem: true });
    } catch (error) {
      console.error("Error editing item:", error);
      return json({ error: "Failed to edit item" }, { status: 500 });
    }
  }

  if (intent === "deleteItem") {
    const itemId = formData.get("itemId")?.toString();
    
    try {
      const groceryList = await db.groceryList.findFirst({
        where: { id: listId, userId },
        include: {
          items: true
        }
      });

      if (!groceryList) {
        throw new Response("Grocery list not found", { status: 404 });
      }

      await db.groceryListItem.delete({
        where: { id: itemId }
      });

      return json({ success: true });
    } catch (error) {
      console.error("Error deleting item:", error);
      return json({ error: "Failed to delete item" }, { status: 500 });
    }
  }

  if (intent === "deleteList") {
    try {
      // First verify the grocery list exists and belongs to the user
      const groceryList = await db.groceryList.findFirst({
        where: { id: listId, userId },
        include: {
          items: true
        }
      });

      if (!groceryList) {
        throw new Response("Grocery list not found", { status: 404 });
      }

      // Delete using only the ID since we've already verified ownership
      await db.groceryList.delete({
        where: { id: listId }
      });

      // Redirect to grocery lists index after successful deletion
      return redirect("/grocery-lists");
    } catch (error) {
      console.error("Error deleting grocery list:", error);
      return json({ error: "Failed to delete grocery list" }, { status: 500 });
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

export default function GroceryListDetail() {
  const { groceryList } = useLoaderData<typeof loader>();
  
  // groceryList is guaranteed to exist due to loader throwing 404 if not found
  if (!groceryList) {
    throw new Error("Grocery list not found");
  }
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editSuccessFlag, setEditSuccessFlag] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Handle action responses
  useEffect(() => {
    if (actionData && !isSubmitting) {
      if ('success' in actionData && actionData.success) {
        if ('addedItem' in actionData && actionData.addedItem) {
          setIsAddingItem(false);
          setToast({ message: 'Item added!', type: 'success' });
        } else if ('editedItem' in actionData && actionData.editedItem) {
          setToast({ message: 'Item updated!', type: 'success' });
          setEditSuccessFlag(true);
          // Reset the flag after a short delay to allow the component to react
          setTimeout(() => setEditSuccessFlag(false), 100);
        }
      } else if ('error' in actionData && actionData.error) {
        setToast({ message: actionData.error, type: 'error' });
      }
    }
  }, [actionData, isSubmitting]);

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDeleteConfirm(false);
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center mb-4">
              <Trash2 size={24} className="text-red-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Delete Grocery List</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "<strong>{groceryList.name}</strong>"? 
              This action cannot be undone and will permanently remove all items in this list.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <form method="post" className="inline">
                <input type="hidden" name="intent" value="deleteList" />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Deleting...' : 'Delete List'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-end mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
            >
              <Trash2 size={16} className="mr-2" />
              Delete List
            </button>
            <button
              onClick={() => setIsAddingItem(true)}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
            >
              <Plus size={16} className="mr-2" />
              Add Item
            </button>
          </div>
        </div>
        
        <div className="flex items-center mb-4">
          <ShoppingCart size={32} className="text-green-600 mr-3" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{groceryList.name}</h1>
          </div>
        </div>
      </div>

      {/* Grocery List View Component */}
      <GroceryListView
        items={groceryList.items}
        showAddForm={isAddingItem}
        isSubmitting={isSubmitting}
        onAddItem={() => setIsAddingItem(true)}
        onCancelAdd={() => setIsAddingItem(false)}
        editSuccess={editSuccessFlag}
      />
    </div>
  );
}