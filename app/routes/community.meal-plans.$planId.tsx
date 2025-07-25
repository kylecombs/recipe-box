import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Calendar, Clock, Users } from "lucide-react";
import { db } from "~/utils/db.server";
import StarRating from "~/components/StarRating";
import RatingForm from "~/components/RatingForm";
import { getUserId } from "~/utils/auth.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { planId } = params;
  if (!planId) {
    throw new Response("Meal plan not found", { status: 404 });
  }

  const userId = await getUserId(request);

  const mealPlan = await db.mealPlan.findUnique({
    where: { id: planId },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      ratings: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!mealPlan) {
    throw new Response("Meal plan not found", { status: 404 });
  }

  const averageRating = mealPlan.ratings.length > 0
    ? mealPlan.ratings.reduce((sum, rating) => sum + rating.rating, 0) / mealPlan.ratings.length
    : 0;

  const userRating = userId
    ? mealPlan.ratings.find((rating) => rating.userId === userId)
    : null;

  return json({
    mealPlan,
    averageRating,
    userRating,
    userId,
  });
}

export default function CommunityMealPlanDetail() {
  const { mealPlan, averageRating, userRating, userId } = useLoaderData<typeof loader>();

  const formatMealPlan = (weekPlan: any) => {
    if (!weekPlan || !Array.isArray(weekPlan)) {
      return [];
    }
    return weekPlan;
  };

  const formatShoppingList = (shoppingList: any) => {
    if (!shoppingList || !Array.isArray(shoppingList)) {
      return [];
    }
    return shoppingList;
  };

  const weekPlanData = formatMealPlan(mealPlan.weekPlan);
  const shoppingListData = formatShoppingList(mealPlan.shoppingList);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
          <Link to="/community/meal-plans" className="hover:text-gray-700">
            Community Meal Plans
          </Link>
          <span>/</span>
          <span>{mealPlan.name}</span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">{mealPlan.name}</h1>
        
        {mealPlan.description && (
          <p className="text-gray-600 mb-6">{mealPlan.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600 mb-6">
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />
            <span>{mealPlan.days} day{mealPlan.days !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Users className="h-4 w-4" />
            <span>by {mealPlan.user.name || mealPlan.user.email}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>Created {new Date(mealPlan.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Rating Section */}
        <div className="bg-gray-50 rounded-lg p-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <StarRating rating={averageRating} readonly />
              <span className="text-sm text-gray-600">
                {averageRating.toFixed(1)} ({mealPlan.ratings.length} rating{mealPlan.ratings.length !== 1 ? 's' : ''})
              </span>
            </div>
            {userId && (
              <RatingForm
                itemType="mealplan"
                itemId={mealPlan.id}
                currentRating={userRating?.rating || 0}
                currentComment={userRating?.comment || ""}
                compact
              />
            )}
          </div>
        </div>
      </div>

      {/* Meal Plan Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Weekly Plan */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Weekly Plan</h2>
          {weekPlanData.length > 0 ? (
            <div className="space-y-6">
              {weekPlanData.map((dayPlan: any, index: number) => (
                <div key={index} className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {dayPlan.day || `Day ${index + 1}`}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['breakfast', 'lunch', 'dinner'].map((mealType) => (
                      <div key={mealType} className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-700 capitalize">
                          {mealType}
                        </h4>
                        {dayPlan[mealType]?.recipe ? (
                          <div className="bg-gray-50 rounded p-3">
                            <p className="text-sm font-medium text-gray-900">
                              {dayPlan[mealType].recipe}
                            </p>
                            {dayPlan[mealType].notes && (
                              <p className="text-xs text-gray-600 mt-1">
                                {dayPlan[mealType].notes}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">No meal planned</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No meal plan data available.</p>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Shopping List */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Shopping List</h3>
            {shoppingListData.length > 0 ? (
              <ul className="space-y-2">
                {shoppingListData.map((item: any, index: number) => (
                  <li key={index} className="flex justify-between text-sm">
                    <span className="text-gray-900">{item.item}</span>
                    <span className="text-gray-500">
                      {item.quantity} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No shopping list available.</p>
            )}
          </div>

          {/* Notes */}
          {mealPlan.notes && (
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
              <p className="text-gray-700 text-sm whitespace-pre-wrap">{mealPlan.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Ratings and Comments */}
      {mealPlan.ratings.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Ratings & Reviews ({mealPlan.ratings.length})
          </h2>
          <div className="space-y-6">
            {mealPlan.ratings.map((rating) => (
              <div key={rating.id} className="bg-white border rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {(rating.user.name || rating.user.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {rating.user.name || rating.user.email}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <StarRating rating={rating.rating} readonly size={16} />
                        <span className="text-xs text-gray-500">
                          {new Date(rating.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {rating.comment && (
                  <p className="mt-4 text-gray-700 text-sm">{rating.comment}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}