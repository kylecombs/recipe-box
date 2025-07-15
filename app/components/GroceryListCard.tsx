import { Link } from "@remix-run/react";
import { ShoppingCart, Check } from "lucide-react";

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

interface GroceryList {
  id: string;
  name: string;
  items: GroceryListItem[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface GroceryListCardProps {
  groceryList: GroceryList;
  className?: string;
  showProgress?: boolean;
}

export default function GroceryListCard({ 
  groceryList, 
  className = "",
  showProgress = true 
}: GroceryListCardProps) {
  const completedItems = groceryList.items.filter(item => item.checked);
  const completionPercentage = groceryList.items.length > 0 
    ? Math.round((completedItems.length / groceryList.items.length) * 100)
    : 0;

  return (
    <Link
      to={`/grocery-lists/${groceryList.id}`}
      className={`block p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-green-300 transition-all duration-200 ${className}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center min-w-0 flex-1">
          <ShoppingCart size={20} className="text-green-600 mr-3 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 truncate">{groceryList.name}</h3>
            <p className="text-sm text-gray-500">
              {groceryList.items.length} items
            </p>
          </div>
        </div>
        
        {showProgress && groceryList.items.length > 0 && (
          <div className="flex items-center ml-4 flex-shrink-0">
            <div className="text-right mr-2">
              <div className="text-xs font-medium text-gray-700">
                {completionPercentage}%
              </div>
              <div className="text-xs text-gray-500">
                {completedItems.length}/{groceryList.items.length}
              </div>
            </div>
            <div className="relative w-8 h-8">
              <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  className="text-gray-200"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray={`${completionPercentage * 0.88} 88`}
                  className="text-green-500"
                />
              </svg>
              {completionPercentage === 100 && (
                <Check size={12} className="absolute inset-0 m-auto text-green-600" />
              )}
            </div>
          </div>
        )}
      </div>
      
      {showProgress && groceryList.items.length > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      )}
      
      <div className="mt-3 text-xs text-gray-500">
        Updated {new Date(groceryList.updatedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })}
      </div>
    </Link>
  );
}