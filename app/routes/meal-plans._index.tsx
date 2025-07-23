import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Calendar, ChevronRight } from "lucide-react";
import { requireUserId } from "~/utils/auth.server";
import { db } from "~/utils/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  
  const mealPlans = await db.mealPlan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  
  return json({ mealPlans });
}

export default function MealPlans() {
  const { mealPlans } = useLoaderData<typeof loader>();
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Saved Meal Plans</h1>
        <Link
          to="/meal-plan"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Create New Plan
        </Link>
      </div>
      
      {mealPlans.length === 0 ? (
        <div className="text-center py-12">
          <Calendar size={64} className="mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-4">No meal plans yet</h2>
          <p className="text-gray-500 mb-6">
            Create your first meal plan to organize your weekly meals.
          </p>
          <Link
            to="/meal-plan"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Create Meal Plan
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mealPlans.map((plan) => (
            <Link
              key={plan.id}
              to={`/meal-plans/${plan.id}`}
              className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
            >
              <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
              {plan.description && (
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  {plan.description}
                </p>
              )}
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>{plan.days} days</span>
                <span>{new Date(plan.createdAt).toLocaleDateString()}</span>
              </div>
              <ChevronRight className="ml-auto mt-3 text-gray-400" size={20} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}