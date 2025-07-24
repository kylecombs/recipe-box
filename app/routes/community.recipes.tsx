import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Users, Star, Heart, Clock, ChefHat } from "lucide-react";
import { db } from "~/utils/db.server";
import { requireUserId } from "~/utils/auth.server";
import StarRating from "~/components/StarRating";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort") || "popular"; // popular, newest, rating

  // Build where clause for search
  const whereClause: any = {
    isPublic: true,
  };

  if (search) {
    whereClause.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  // Build order by clause
  let orderBy: any;
  switch (sortBy) {
    case "newest":
      orderBy = { publishedAt: "desc" };
      break;
    case "rating":
      orderBy = [{ ratings: { _count: "desc" } }];
      break;
    case "popular":
    default:
      orderBy = { saveCount: "desc" };
      break;
  }

  const publicRecipes = await db.recipe.findMany({
    where: whereClause,
    include: {
      user: {
        select: { name: true, email: true },
      },
      ingredients: {
        orderBy: { createdAt: "asc" },
        take: 5, // Only show first 5 ingredients in list view
      },
      ratings: {
        select: { rating: true },
      },
      userRecipes: {
        where: { userId },
        select: { id: true },
      },
    },
    orderBy,
    take: 50, // Limit results
  });

  // Calculate average ratings and add computed fields
  const recipesWithStats = publicRecipes.map(recipe => ({
    ...recipe,
    averageRating: recipe.ratings.length > 0 
      ? recipe.ratings.reduce((sum, r) => sum + r.rating, 0) / recipe.ratings.length 
      : 0,
    ratingCount: recipe.ratings.length,
    isUserSaved: recipe.userRecipes.length > 0,
  }));

  return json({ 
    recipes: recipesWithStats,
    currentSearch: search,
    currentSort: sortBy,
  });
}

export default function CommunityRecipes() {
  const { recipes, currentSearch, currentSort } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <Users className="mr-3" size={32} />
              Community Recipes
            </h1>
            <p className="text-gray-600 mt-2">
              Discover and save recipes shared by the community
            </p>
          </div>
          
          {/* Search and Filter */}
          <div className="flex gap-3">
            <form method="get" className="flex gap-2">
              <input
                type="text"
                name="search"
                defaultValue={currentSearch}
                placeholder="Search recipes..."
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <input type="hidden" name="sort" value={currentSort} />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                Search
              </button>
            </form>
            
            <form method="get">
              <input type="hidden" name="search" value={currentSearch} />
              <select
                name="sort"
                defaultValue={currentSort}
                onChange={(e) => e.target.form?.submit()}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="popular">Most Saved</option>
                <option value="newest">Newest</option>
                <option value="rating">Highest Rated</option>
              </select>
            </form>
          </div>
        </div>
      </div>

      {/* Results */}
      {recipes.length === 0 ? (
        <div className="text-center py-12">
          <ChefHat size={64} className="mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            {currentSearch ? "No recipes found" : "No public recipes yet"}
          </h2>
          <p className="text-gray-500 mb-6">
            {currentSearch 
              ? `Try adjusting your search terms or browse all recipes`
              : `Be the first to share a recipe with the community!`
            }
          </p>
          {currentSearch && (
            <Link
              to="/community"
              className="text-blue-600 hover:text-blue-700"
            >
              View all recipes
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
            >
              {recipe.imageUrl && (
                <img
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  className="w-full h-48 object-cover"
                />
              )}
              
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <Link
                    to={`/community/${recipe.id}`}
                    className="block"
                  >
                    <h3 className="font-bold text-lg text-gray-900 hover:text-blue-600 line-clamp-2">
                      {recipe.title}
                    </h3>
                  </Link>
                  {recipe.isUserSaved && (
                    <div className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex-shrink-0">
                      <Heart size={10} className="inline mr-1" />
                      Saved
                    </div>
                  )}
                </div>
                
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  by {recipe.user.name || recipe.user.email}
                </p>
                
                {recipe.description && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {recipe.description}
                  </p>
                )}

                {/* Recipe Stats */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex gap-4">
                      {recipe.prepTime && (
                        <span className="flex items-center">
                          <Clock size={12} className="mr-1" />
                          {recipe.prepTime}m
                        </span>
                      )}
                      {recipe.servings && (
                        <span>Serves {recipe.servings}</span>
                      )}
                    </div>
                    <span>{recipe.saveCount} saves</span>
                  </div>
                  
                  {recipe.averageRating > 0 && (
                    <div className="flex items-center">
                      <StarRating rating={Math.round(recipe.averageRating)} readonly size={14} />
                      <span className="ml-2 text-xs text-gray-500">
                        {recipe.averageRating.toFixed(1)} ({recipe.ratingCount} rating{recipe.ratingCount !== 1 ? 's' : ''})
                      </span>
                    </div>
                  )}
                </div>

                {/* Ingredients Preview */}
                {recipe.ingredients.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-700 mb-1">Ingredients:</p>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {recipe.ingredients.slice(0, 3).map(ing => ing.name).join(", ")}
                      {recipe.ingredients.length > 3 && "..."}
                    </p>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <Link
                    to={`/community/${recipe.id}`}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    View Recipe
                  </Link>
                  
                  {!recipe.isUserSaved && (
                    <form method="post" action="/api/community-recipes">
                      <input type="hidden" name="intent" value="save" />
                      <input type="hidden" name="recipeId" value={recipe.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                      >
                        <Heart size={14} className="mr-1" />
                        Save
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}