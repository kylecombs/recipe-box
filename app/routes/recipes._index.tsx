import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Plus } from "lucide-react";
import { db } from "~/utils/db.server";
import { requireUserId } from "~/utils/auth.server";
import RecipeCard from "~/components/RecipeCard";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);

  const recipes = await db.recipe.findMany({
    where: {
      userId: userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return json({ recipes });
};

export default function RecipesIndex() {
  const { recipes } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Recipes</h1>
        <div className="flex gap-4">
          <Link
            to="import"
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center"
          >
            <Plus size={20} className="mr-2" />
            Import from URL
          </Link>
          <Link
            to="new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
          >
            <Plus size={20} className="mr-2" />
            Add Recipe
          </Link>
        </div>
      </div>

      {/* Recipes Grid */}
      {recipes.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">No recipes yet</h2>
          <p className="text-gray-500 mb-6">
            Start building your recipe collection by importing from a URL or adding manually.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              to="import"
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
            >
              Import from URL
            </Link>
            <Link
              to="new"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              Add Manually
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              id={recipe.id}
              title={recipe.title}
              description={recipe.description || undefined}
              imageUrl={recipe.imageUrl || undefined}
              prepTime={recipe.prepTime || undefined}
              cookTime={recipe.cookTime || undefined}
              servings={recipe.servings || undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}