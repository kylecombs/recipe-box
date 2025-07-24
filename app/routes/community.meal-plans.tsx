import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useState } from "react";
import { db } from "~/utils/db.server";
import { getUserId } from "~/utils/auth.server";
import StarRating from "~/components/StarRating";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const sort = url.searchParams.get("sort") || "newest";
  
  const userId = await getUserId(request);

  const whereClause = {
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  let orderBy;
  switch (sort) {
    case "newest":
    default:
      orderBy = { createdAt: "desc" as const };
      break;
  }

  const mealPlans = await db.mealPlan.findMany({
    where: whereClause,
    orderBy,
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      ratings: {
        select: {
          rating: true,
        },
      },
    },
  });

  const mealPlansWithStats = mealPlans.map((plan) => {
    const ratings = plan.ratings;
    const averageRating = ratings.length > 0 
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
      : 0;
    const ratingCount = ratings.length;

    return {
      ...plan,
      averageRating,
      ratingCount,
    };
  });

  return json({ mealPlans: mealPlansWithStats, userId });
}

export default function CommunityMealPlans() {
  const { mealPlans } = useLoaderData<typeof loader>();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const formatPreview = (weekPlan: any) => {
    if (!weekPlan || !Array.isArray(weekPlan) || weekPlan.length === 0) {
      return "No meals planned";
    }
    
    const firstDay = weekPlan[0];
    const meals = [];
    if (firstDay.breakfast?.recipe) meals.push(firstDay.breakfast.recipe);
    if (firstDay.lunch?.recipe) meals.push(firstDay.lunch.recipe);
    if (firstDay.dinner?.recipe) meals.push(firstDay.dinner.recipe);
    
    return meals.length > 0 ? meals.slice(0, 2).join(", ") + (meals.length > 2 ? "..." : "") : "No meals planned";
  };

  const handleSearch = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("search", searchTerm);
    url.searchParams.set("sort", sortBy);
    window.location.href = url.toString();
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    const url = new URL(window.location.href);
    url.searchParams.set("sort", newSort);
    if (searchTerm) {
      url.searchParams.set("search", searchTerm);
    }
    window.location.href = url.toString();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Community Meal Plans</h1>
        <p className="text-gray-600 mb-6">
          Discover and save meal plans shared by the community
        </p>

        {/* Search and Sort */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search meal plans..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                onClick={handleSearch}
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            </div>
          </div>
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {mealPlans.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No meal plans found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search or check back later for new meal plans.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mealPlans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                    {plan.name}
                  </h3>
                </div>
                
                {plan.description && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {plan.description}
                  </p>
                )}

                <div className="mb-3">
                  <span className="text-sm text-gray-500">
                    {plan.days} day{plan.days !== 1 ? 's' : ''} • by {plan.user.name || plan.user.email}
                  </span>
                </div>

                <div className="mb-3">
                  <p className="text-sm text-gray-600 line-clamp-1">
                    <span className="font-medium">Preview:</span> {formatPreview(plan.weekPlan)}
                  </p>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <StarRating rating={plan.averageRating} readonly />
                    <span className="text-sm text-gray-500">
                      ({plan.ratingCount})
                    </span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Link
                    to={`/community/meal-plans/${plan.id}`}
                    className="flex-1 bg-indigo-600 text-white text-center py-2 px-4 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}