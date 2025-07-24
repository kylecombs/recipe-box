import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { ShoppingCart, Plus } from "lucide-react";
import { db } from "~/utils/db.server";
import { requireUserId } from "~/utils/auth.server";
import GroceryListCard from "~/components/GroceryListCard";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  
  const groceryLists = await db.groceryList.findMany({
    where: { userId },
    include: {
      items: true
    }
  });

  return json({ groceryLists });
};

export default function GroceryLists() {
  const { groceryLists } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900">My Grocery Lists</h1>
          
          <div className="flex gap-3 items-center">
            <Link
              to="/grocery-lists/new"
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
            >
              <Plus size={16} className="mr-2" />
              New List
            </Link>
          </div>
        </div>
      </div>

      {groceryLists.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groceryLists.map((list) => (
            <GroceryListCard
              key={list.id}
              groceryList={list}
              showProgress={true}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <ShoppingCart size={64} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No grocery lists yet</h3>
          <p className="text-gray-500 mb-6">
            Create your first grocery list or add ingredients from a recipe.
          </p>
          <Link
            to="/grocery-lists/new"
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
          >
            <Plus size={16} className="mr-2" />
            Create Your First List
          </Link>
        </div>
      )}
    </div>
  );
}