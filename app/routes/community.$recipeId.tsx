import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, Form, useFetcher } from "@remix-run/react";
import { ArrowLeft, Clock, Users, Heart, Star, Globe, ChefHat } from "lucide-react";
import { db } from "~/utils/db.server";
import { requireUserId } from "~/utils/auth.server";
import IngredientsList from "~/components/IngredientsList";
import InstructionsList from "~/components/InstructionsList";
import TagsList from "~/components/TagsList";
import StarRating from "~/components/StarRating";
import RatingForm from "~/components/RatingForm";
import Toast from "~/components/Toast";
import { useState, useEffect } from "react";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const { recipeId } = params;

  if (!recipeId) {
    throw new Response("Recipe not found", { status: 404 });
  }

  // Find the public recipe
  const recipe = await db.recipe.findFirst({
    where: {
      id: recipeId,
      isPublic: true,
    },
    include: {
      user: {
        select: { name: true, email: true },
      },
      ingredients: {
        orderBy: { createdAt: "asc" },
      },
      instructionSteps: {
        orderBy: { stepNumber: "asc" },
      },
      tags: {
        include: {
          tag: true,
        },
      },
    },
  });

  if (!recipe) {
    throw new Response("Recipe not found", { status: 404 });
  }

  // Check if user has saved this recipe
  const userSaved = await db.userRecipe.findFirst({
    where: {
      userId,
      recipeId,
    },
  });

  // Fetch user's rating for this recipe
  const userRating = await db.recipeRating.findUnique({
    where: {
      userId_recipeId: {
        userId,
        recipeId,
      },
    },
  });

  // Fetch average rating and total ratings
  const ratingStats = await db.recipeRating.aggregate({
    where: { recipeId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return json({ 
    recipe, 
    isUserSaved: !!userSaved,
    userRating,
    ratingStats,
  });
}

export default function CommunityRecipeDetail() {
  const { recipe, isUserSaved, userRating, ratingStats } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Handle fetcher state changes
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.success) {
        setShowSuccessToast(true);
        setShowErrorToast(false);
        setToastMessage(fetcher.data.message || "Action completed successfully!");
      } else if (fetcher.data.error) {
        setShowErrorToast(true);
        setShowSuccessToast(false);
        setToastMessage(fetcher.data.error);
      }
    }
  }, [fetcher.state, fetcher.data]);

  const handleSaveRecipe = () => {
    const formData = new FormData();
    formData.append("intent", "save");
    formData.append("recipeId", recipe.id);
    
    fetcher.submit(formData, {
      method: "post",
      action: "/api/community-recipes",
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Toast
        message={toastMessage}
        type="success"
        show={showSuccessToast}
        onClose={() => setShowSuccessToast(false)}
      />
      
      <Toast
        message={toastMessage}
        type="error"
        show={showErrorToast}
        onClose={() => setShowErrorToast(false)}
      />

      {/* Header */}
      <div className="mb-6">
        <Link
          to="/community"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft size={20} className="mr-1" />
          Back to Community Recipes
        </Link>
        
        <div className="flex flex-col lg:flex-row gap-6">
          {recipe.imageUrl && (
            <div className="lg:w-1/3">
              <img
                src={recipe.imageUrl}
                alt={recipe.title}
                className="w-full h-64 lg:h-80 object-cover rounded-lg shadow-lg"
              />
            </div>
          )}
          
          <div className={recipe.imageUrl ? "lg:w-2/3" : "w-full"}>
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-3xl font-bold text-gray-900">{recipe.title}</h1>
              <div className="flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                <Globe size={12} className="mr-1" />
                Public
              </div>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-600">
                by <span className="font-medium">{recipe.user.name || recipe.user.email}</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Published on {new Date(recipe.publishedAt || recipe.createdAt).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-500">
                {recipe.saveCount} saves
              </p>
            </div>
            
            {recipe.description && (
              <p className="text-gray-600 text-lg mb-4">{recipe.description}</p>
            )}
            
            {/* Recipe Meta */}
            <div className="flex flex-wrap gap-6 text-sm text-gray-600 mb-4">
              {recipe.prepTime && (
                <div className="flex items-center">
                  <Clock size={16} className="mr-1" />
                  <span>Prep: {recipe.prepTime}m</span>
                </div>
              )}
              {recipe.cookTime && (
                <div className="flex items-center">
                  <Clock size={16} className="mr-1" />
                  <span>Cook: {recipe.cookTime}m</span>
                </div>
              )}
              {recipe.servings && (
                <div className="flex items-center">
                  <Users size={16} className="mr-1" />
                  <span>Serves: {recipe.servings}</span>
                </div>
              )}
            </div>

            {/* Ratings Section */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <div className="flex flex-col space-y-3">
                {/* Average Rating Display */}
                {ratingStats._count.rating > 0 && (
                  <div className="flex items-center space-x-3">
                    <StarRating 
                      rating={Math.round(ratingStats._avg.rating || 0)} 
                      readonly 
                      size={18}
                    />
                    <span className="text-sm text-gray-600">
                      {(ratingStats._avg.rating || 0).toFixed(1)} 
                      ({ratingStats._count.rating} rating{ratingStats._count.rating !== 1 ? 's' : ''})
                    </span>
                  </div>
                )}
                
                {/* User's Rating */}
                <div>
                  {userRating ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-700">Your rating:</span>
                          <StarRating rating={userRating.rating} readonly size={16} />
                        </div>
                        <button
                          onClick={() => setShowRatingForm(true)}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Edit
                        </button>
                      </div>
                      {userRating.comment && (
                        <p className="text-sm text-gray-600 italic">"{userRating.comment}"</p>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowRatingForm(true)}
                      className="inline-flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <Star size={16} />
                      <span>Rate this recipe</span>
                    </button>
                  )}
                </div>
                
                {/* Rating Form */}
                {showRatingForm && (
                  <div className="mt-4">
                    <RatingForm
                      itemId={recipe.id}
                      itemType="recipe"
                      currentRating={userRating?.rating || 0}
                      currentComment={userRating?.comment || ""}
                      onClose={() => setShowRatingForm(false)}
                      compact
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              {!isUserSaved ? (
                <button
                  onClick={handleSaveRecipe}
                  disabled={fetcher.state === "submitting"}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  <Heart size={16} className="mr-2" />
                  {fetcher.state === "submitting" ? "Saving..." : "Save to My Recipes"}
                </button>
              ) : (
                <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-lg">
                  <Heart size={16} className="mr-2" />
                  Saved to My Recipes
                </div>
              )}
            </div>
            
            {/* Tags */}
            {recipe.tags.length > 0 && (
              <div className="mt-6">
                <TagsList tags={recipe.tags.map(rt => rt.tag.name)} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recipe Content */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Ingredients */}
        <div className="lg:col-span-1">
          <IngredientsList ingredients={recipe.ingredients} originalServings={recipe.servings} />
        </div>
        
        {/* Instructions */}
        <div className="lg:col-span-2">
          <InstructionsList instructions={recipe.instructionSteps} />
        </div>
      </div>
    </div>
  );
}