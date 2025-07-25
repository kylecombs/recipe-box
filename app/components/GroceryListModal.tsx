import { Form, type FetcherWithComponents } from "@remix-run/react";
import { ShoppingCart } from "lucide-react";

interface GroceryList {
  id: string;
  name: string;
}

interface GroceryListModalProps {
  isOpen: boolean;
  onClose: () => void;
  groceryLists: GroceryList[];
  selectedGroceryListId: string;
  setSelectedGroceryListId: (id: string) => void;
  newGroceryListName: string;
  setNewGroceryListName: (name: string) => void;
  itemCount: number;
  itemDescription?: string;
  actionIntent?: string;
  additionalInputs?: React.ReactNode;
  fetcher?: FetcherWithComponents<unknown>;
}

export default function GroceryListModal({
  isOpen,
  onClose,
  groceryLists,
  selectedGroceryListId,
  setSelectedGroceryListId,
  newGroceryListName,
  setNewGroceryListName,
  itemCount,
  itemDescription = "ingredients",
  actionIntent = "addToGroceryList",
  additionalInputs,
  fetcher
}: GroceryListModalProps) {
  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
    setSelectedGroceryListId('');
    setNewGroceryListName('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center mb-4">
          <ShoppingCart size={24} className="text-green-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Add to Grocery List</h3>
        </div>
        
        {fetcher ? (
          <fetcher.Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value={actionIntent} />
            {additionalInputs}
            
            {groceryLists.length > 0 && (
              <div>
                <label htmlFor="groceryListSelect1" className="block text-sm font-medium text-gray-700 mb-2">
                  Select existing list:
                </label>
                <select
                  id="groceryListSelect1"
                  name="groceryListId"
                  value={selectedGroceryListId}
                  onChange={(e) => {
                    setSelectedGroceryListId(e.target.value);
                    if (e.target.value) setNewGroceryListName('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">-- Select a list --</option>
                  {groceryLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="text-center text-sm text-gray-500">
              {groceryLists.length > 0 ? 'or' : ''}
            </div>
            
            <div>
              <label htmlFor="newListName1" className="block text-sm font-medium text-gray-700 mb-2">
                Create new list:
              </label>
              <input
                type="text"
                id="newListName1"
                name="newListName"
                value={newGroceryListName}
                onChange={(e) => {
                  setNewGroceryListName(e.target.value);
                  if (e.target.value) setSelectedGroceryListId('');
                }}
                placeholder="Enter list name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-sm text-gray-600 mb-2">
                This will add all {itemCount} {itemDescription} from this meal plan.
              </p>
              <p className="text-xs text-gray-500">
                Duplicate ingredients will be combined with existing quantities.
              </p>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              
              <button
                type="submit"
                disabled={!selectedGroceryListId && !newGroceryListName.trim()}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart size={16} className="mr-2" />
                Add Ingredients
              </button>
            </div>
          </fetcher.Form>
        ) : (
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value={actionIntent} />
            {additionalInputs}
            
            {groceryLists.length > 0 && (
              <div>
                <label htmlFor="groceryListSelect2" className="block text-sm font-medium text-gray-700 mb-2">
                  Select existing list:
                </label>
                <select
                  id="groceryListSelect2"
                  name="groceryListId"
                  value={selectedGroceryListId}
                  onChange={(e) => {
                    setSelectedGroceryListId(e.target.value);
                    if (e.target.value) setNewGroceryListName('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">-- Select a list --</option>
                  {groceryLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="text-center text-sm text-gray-500">
              {groceryLists.length > 0 ? 'or' : ''}
            </div>
            
            <div>
              <label htmlFor="newListName2" className="block text-sm font-medium text-gray-700 mb-2">
                Create new list:
              </label>
              <input
                type="text"
                id="newListName2"
                name="newListName"
                value={newGroceryListName}
                onChange={(e) => {
                  setNewGroceryListName(e.target.value);
                  if (e.target.value) setSelectedGroceryListId('');
                }}
                placeholder="Enter list name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-sm text-gray-600 mb-2">
                This will add all {itemCount} {itemDescription} from this meal plan.
              </p>
              <p className="text-xs text-gray-500">
                Duplicate ingredients will be combined with existing quantities.
              </p>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              
              <button
                type="submit"
                disabled={!selectedGroceryListId && !newGroceryListName.trim()}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart size={16} className="mr-2" />
                Add Ingredients
              </button>
            </div>
          </Form>
        )}
      </div>
    </div>
  );
}