import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Calendar, ChevronRight, Edit, Bot, ChefHat } from "lucide-react";
import { requireUserId } from "~/utils/auth.server";
import { db } from "~/utils/db.server";
import StarRating from "~/components/StarRating";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  
  const mealPlans = await db.mealPlan.findMany({
    where: { userId },
    include: {
      ratings: {
        where: { userId },
        select: { rating: true, comment: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Add user rating to each meal plan
  const mealPlansWithRatings = mealPlans.map(plan => ({
    ...plan,
    userRating: plan.ratings[0] || null,
  }));
  
  return json({ mealPlans: mealPlansWithRatings });
}

export default function MealPlans() {
  const { mealPlans } = useLoaderData<typeof loader>();
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <h1 className="text-3xl font-bold">My Meal Plans</h1>
        <div className="flex gap-3 pt-4 sm:pt-0">
          <Link
            to="/meal-plans/new"
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <ChefHat size={16} className="mr-2 hidden sm:block" />
            Create Manually
          </Link>
          <Link
            to="/meal-plan"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Bot size={16} className="mr-2 hidden sm:block" />
            Generate with AI
          </Link>
        </div>
      </div>
      
      {mealPlans.length === 0 ? (
        <div className="text-center py-12">
          <Calendar size={64} className="mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-4">No meal plans yet</h2>
          <p className="text-gray-500 mb-6">
            Create your first meal plan to organize your weekly meals.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              to="/meal-plans/new"
              className="inline-flex items-center bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
            >
              <ChefHat size={20} className="mr-2" />
              Create Manually
            </Link>
            <Link
              to="/meal-plan"
              className="inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              <Bot size={20} className="mr-2" />
              Generate with AI
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mealPlans.map((plan) => (
            <div
              key={plan.id}
              className="flex flex-col justify-between bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
            >
              <Link
                to={`/meal-plans/${plan.id}`}
                className="block"
              >
                <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
                {plan.description && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {plan.description}
                  </p>
                )}
                <div className="flex justify-between items-center text-sm text-gray-500 mb-3">
                  <span>{plan.days} days</span>
                  <span>{new Date(plan.createdAt).toLocaleDateString()}</span>
                </div>
                {plan.userRating && (
                  <div className="flex items-center mb-3">
                    <StarRating rating={plan.userRating.rating} readonly size={14} />
                    <span className="ml-2 text-xs text-gray-500">Your rating</span>
                  </div>
                )}
              </Link>
              <div className="flex justify-between items-center">
                <Link
                  to={`/meal-plans/edit/${plan.id}`}
                  className="inline-flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Edit size={14} className="mr-1" />
                  Edit
                </Link>
                <Link
                  to={`/meal-plans/${plan.id}`}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ChevronRight size={20} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}