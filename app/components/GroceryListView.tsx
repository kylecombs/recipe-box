import { Form } from "@remix-run/react";
import { Check, Plus, Trash2, ShoppingCart, Edit3, Save, X } from "lucide-react";
import { useState, useEffect } from "react";

interface GroceryListItem {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  notes: string | null;
  checked: boolean;
  groceryListId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface GroceryListViewProps {
  items: GroceryListItem[];
  showAddForm?: boolean;
  isSubmitting?: boolean;
  onAddItem?: () => void;
  onCancelAdd?: () => void;
  className?: string;
  editSuccess?: boolean;
}

export default function GroceryListView({ 
  items, 
  showAddForm = false, 
  isSubmitting = false,
  onAddItem,
  onCancelAdd,
  className = "",
  editSuccess = false
}: GroceryListViewProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    quantity: string;
    unit: string;
  }>({ name: '', quantity: '', unit: '' });
  
  const completedItems = items.filter(item => item.checked);
  const pendingItems = items.filter(item => !item.checked);

  const startEditing = (item: GroceryListItem) => {
    setEditingItemId(item.id);
    setEditForm({
      name: item.name,
      quantity: item.quantity || '',
      unit: item.unit || ''
    });
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setEditForm({ name: '', quantity: '', unit: '' });
  };

  // Reset editing state when edit is successful
  useEffect(() => {
    if (editSuccess && !isSubmitting) {
      setEditingItemId(null);
      setEditForm({ name: '', quantity: '', unit: '' });
    }
  }, [editSuccess, isSubmitting]);

  return (
    <div className={className}>
      {/* Progress Bar */}
      {items.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              {completedItems.length} of {items.length} items completed
            </span>
            <span className="text-sm text-gray-500">
              {Math.round((completedItems.length / items.length) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-green-600 h-3 rounded-full transition-all duration-300"
              style={{ 
                width: `${(completedItems.length / items.length) * 100}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Add Item Form */}
      {showAddForm && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="addItem" />
            <div className="grid grid-cols-12 gap-2">
              <input
                type="text"
                name="quantity"
                placeholder="Qty"
                className="col-span-2 px-2 py-2 border border-green-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="text"
                name="unit"
                placeholder="Unit"
                className="col-span-2 px-2 py-2 border border-green-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="text"
                name="name"
                placeholder="Item name"
                required
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                className="col-span-6 px-2 py-2 border border-green-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="col-span-2 px-2 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? '...' : 'Add'}
              </button>
            </div>
            {onCancelAdd && (
              <button
                type="button"
                onClick={onCancelAdd}
                className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            )}
          </Form>
        </div>
      )}

      {/* Grocery List Items */}
      {items.length > 0 ? (
        <div className="space-y-6">
          {/* Pending Items */}
          {pendingItems.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <ShoppingCart size={20} className="mr-2 text-green-600" />
                Shopping List ({pendingItems.length})
              </h3>
              <div className="space-y-2">
                {pendingItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                    <Form method="post" className="flex-shrink-0">
                      <input type="hidden" name="intent" value="toggleItem" />
                      <input type="hidden" name="itemId" value={item.id} />
                      <button
                        type="submit"
                        className="w-5 h-5 border-2 border-gray-300 rounded hover:border-green-500 transition-colors flex items-center justify-center"
                        title="Mark as completed"
                      >
                        <div className="w-3 h-3 rounded bg-transparent hover:bg-green-100 transition-colors" />
                      </button>
                    </Form>
                    
                    <div className="flex-1 min-w-0">
                      {editingItemId === item.id ? (
                        <Form method="post" className="grid grid-cols-12 gap-2">
                          <input type="hidden" name="intent" value="editItem" />
                          <input type="hidden" name="itemId" value={item.id} />
                          <input
                            type="text"
                            name="quantity"
                            value={editForm.quantity}
                            onChange={(e) => setEditForm({...editForm, quantity: e.target.value})}
                            placeholder="Qty"
                            className="col-span-2 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <input
                            type="text"
                            name="unit"
                            value={editForm.unit}
                            onChange={(e) => setEditForm({...editForm, unit: e.target.value})}
                            placeholder="Unit"
                            className="col-span-2 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <input
                            type="text"
                            name="name"
                            value={editForm.name}
                            onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                            placeholder="Item name"
                            required
                            className="col-span-6 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <div className="col-span-2 flex gap-1">
                            <button
                              type="submit"
                              className="flex-1 px-2 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors flex items-center justify-center"
                              title="Save changes"
                            >
                              <Save size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="flex-1 px-2 py-1 bg-gray-400 text-white text-sm rounded hover:bg-gray-500 transition-colors flex items-center justify-center"
                              title="Cancel editing"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </Form>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.quantity && item.unit && (
                            <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                              {item.quantity} {item.unit}
                            </span>
                          )}
                          {item.quantity && !item.unit && (
                            <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                              {item.quantity}
                            </span>
                          )}
                          <span className="text-gray-900 font-medium">
                            {item.name}
                          </span>
                          {item.notes && !item.notes.startsWith('Original: ') && (
                            <span className="text-xs text-gray-500 italic">({item.notes})</span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-shrink-0 flex gap-1">
                      {editingItemId !== item.id && (
                        <button
                          type="button"
                          onClick={() => startEditing(item)}
                          className="p-1 text-blue-400 hover:text-blue-600 transition-colors"
                          title="Edit item"
                        >
                          <Edit3 size={16} />
                        </button>
                      )}
                      <Form method="post">
                        <input type="hidden" name="intent" value="deleteItem" />
                        <input type="hidden" name="itemId" value={item.id} />
                        <button
                          type="submit"
                          className="p-1 text-red-400 hover:text-red-600 transition-colors"
                          title="Delete item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </Form>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Items */}
          {completedItems.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <Check size={20} className="mr-2 text-green-600" />
                Completed ({completedItems.length})
              </h3>
              <div className="space-y-2">
                {completedItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg opacity-75">
                    <Form method="post" className="flex-shrink-0">
                      <input type="hidden" name="intent" value="toggleItem" />
                      <input type="hidden" name="itemId" value={item.id} />
                      <button
                        type="submit"
                        className="w-5 h-5 bg-green-500 border-2 border-green-500 rounded flex items-center justify-center text-white hover:bg-green-600 transition-colors"
                        title="Mark as pending"
                      >
                        <Check size={12} />
                      </button>
                    </Form>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.quantity && item.unit && (
                          <span className="text-sm font-medium text-gray-500 line-through bg-gray-200 px-2 py-1 rounded">
                            {item.quantity} {item.unit}
                          </span>
                        )}
                        {item.quantity && !item.unit && (
                          <span className="text-sm font-medium text-gray-500 line-through bg-gray-200 px-2 py-1 rounded">
                            {item.quantity}
                          </span>
                        )}
                        <span className="text-gray-500 line-through font-medium">
                          {item.name}
                        </span>
                        {item.notes && !item.notes.startsWith('Original: ') && (
                          <span className="text-xs text-gray-400 italic line-through">({item.notes})</span>
                        )}
                      </div>
                    </div>
                    
                    <Form method="post" className="flex-shrink-0">
                      <input type="hidden" name="intent" value="deleteItem" />
                      <input type="hidden" name="itemId" value={item.id} />
                      <button
                        type="submit"
                        className="p-1 text-red-300 hover:text-red-500 transition-colors"
                        title="Delete item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </Form>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <ShoppingCart size={64} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No items yet</h3>
          <p className="text-gray-500 mb-6">
            Add your first item to get started with your grocery list.
          </p>
          {onAddItem && (
            <button
              onClick={onAddItem}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
            >
              <Plus size={16} className="mr-2" />
              Add First Item
            </button>
          )}
        </div>
      )}
    </div>
  );
}