import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Plus } from "lucide-react";
import { db } from "~/utils/db.server";
import { requireUserId } from "~/utils/auth.server";
import RecipeCard from "~/components/RecipeCard";
import PopularRecipesCarousel from "~/components/PopularRecipesCarousel";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);

  const userRecipes = await db.userRecipe.findMany({
    where: {
      userId: userId,
    },
    include: {
      recipe: {
        include: {
          ratings: {
            where: { userId },
            select: { rating: true, comment: true },
          },
        },
      },
    },
    orderBy: {
      importedAt: "desc",
    },
  });

  const recipes = userRecipes.map(ur => ({
    ...ur.recipe,
    hasUpdates: ur.hasUpdates,
    importedAt: ur.importedAt,
    userRating: ur.recipe.ratings[0] || null,
  }));

  // Fetch popular public recipes for carousel
  const popularRecipes = await db.recipe.findMany({
    where: {
      isPublic: true,
      saveCount: { gt: 0 }, // Only show recipes that have been saved
    },
    include: {
      user: {
        select: { name: true, email: true },
      },
      ratings: {
        select: { rating: true },
      },
      userRecipes: {
        where: { userId },
        select: { id: true },
      },
    },
    orderBy: { saveCount: "desc" },
    take: 9, // 3 pages of 3 recipes each
  });

  // Calculate average ratings and add computed fields for popular recipes
  const popularRecipesWithStats = popularRecipes.map(recipe => ({
    ...recipe,
    averageRating: recipe.ratings.length > 0 
      ? recipe.ratings.reduce((sum, r) => sum + r.rating, 0) / recipe.ratings.length 
      : 0,
    ratingCount: recipe.ratings.length,
    isUserSaved: recipe.userRecipes.length > 0,
  }));

  return json({ recipes, popularRecipes: popularRecipesWithStats });
};

export default function RecipesIndex() {
  const { recipes, popularRecipes } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Page Header */}
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Recipes</h1>
        <div className="flex gap-4 items-center pt-4 sm:pt-0">
          <Link
            to="import"
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center"
          >
            <Plus size={20} className="mr-2 hidden sm:block" />
            Import from URL
          </Link>
          <Link
            to="new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
          >
            <Plus size={20} className="mr-2 hidden sm:block" />
            Add Recipe
          </Link>
        </div>
      </div>

      {/* Popular Recipes Carousel */}
      {popularRecipes.length > 0 && (
        <PopularRecipesCarousel 
          recipes={popularRecipes} 
          title="Popular Community Recipes"
          showSaveButton={true}
        />
      )}

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
              hasUpdates={recipe.hasUpdates}
              userRating={recipe.userRating}
            />
          ))}
        </div>
      )}
    </div>
  );
}