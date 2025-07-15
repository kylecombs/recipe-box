import { json, ActionFunctionArgs, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation, Link } from "@remix-run/react";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { db } from "~/utils/db.server";
import { requireUserId } from "~/utils/auth.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const name = formData.get("name")?.toString();
  
  if (!name?.trim()) {
    return json({ error: "List name is required" }, { status: 400 });
  }

  try {
    const groceryList = await db.groceryList.create({
      data: {
        name: name.trim(),
        userId
      }
    });

    return redirect(`/grocery-lists/${groceryList.id}`);
  } catch (error) {
    console.error("Error creating grocery list:", error);
    return json({ error: "Failed to create grocery list" }, { status: 500 });
  }
};

export default function NewGroceryList() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="mb-6">
        <Link 
          to="/grocery-lists" 
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Grocery Lists
        </Link>
        
        <div className="flex items-center mb-4">
          <ShoppingCart size={32} className="text-green-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">New Grocery List</h1>
        </div>
      </div>

      <Form method="post" className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            List Name *
          </label>
          <input
            type="text"
            name="name"
            id="name"
            required
            placeholder="e.g., Weekly Groceries, Party Shopping..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </div>
        
        {actionData?.error && (
          <div className="text-red-600 text-sm">
            {actionData.error}
          </div>
        )}
        
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            <ShoppingCart size={16} className="mr-2" />
            {isSubmitting ? 'Creating...' : 'Create List'}
          </button>
          
          <Link
            to="/grocery-lists"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </Form>
    </div>
  );
}