import { Link } from "@remix-run/react";
import { Heart, Clock, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import StarRating from "./StarRating";

interface PopularRecipe {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  saveCount: number;
  averageRating: number;
  ratingCount: number;
  user: {
    name?: string;
    email: string;
  };
  isUserSaved: boolean;
}

interface PopularRecipesCarouselProps {
  recipes: PopularRecipe[];
  title?: string;
  showSaveButton?: boolean;
}

export default function PopularRecipesCarousel({ 
  recipes, 
  title = "Popular Community Recipes",
  showSaveButton = true 
}: PopularRecipesCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const recipesPerPage = 3;
  const totalPages = Math.ceil(recipes.length / recipesPerPage);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % totalPages);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages);
  };

  const getCurrentRecipes = () => {
    const start = currentIndex * recipesPerPage;
    return recipes.slice(start, start + recipesPerPage);
  };

  if (recipes.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <div className="flex items-center gap-2">
          {totalPages > 1 && (
            <>
              <button
                onClick={prevSlide}
                disabled={currentIndex === 0}
                className="p-2 rounded-full border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm text-gray-500 mx-2">
                {currentIndex + 1} / {totalPages}
              </span>
              <button
                onClick={nextSlide}
                disabled={currentIndex === totalPages - 1}
                className="p-2 rounded-full border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
          <Link
            to="/community"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            View All
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {getCurrentRecipes().map((recipe) => (
          <div
            key={recipe.id}
            className="bg-gray-50 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
          >
            {recipe.imageUrl && (
              <div className="relative">
                <img
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  className="w-full h-40 object-cover"
                />
                <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded-full text-xs font-medium">
                  <Heart size={12} className="inline mr-1 text-red-500" />
                  {recipe.saveCount}
                </div>
              </div>
            )}
            
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <Link
                  to={`/community/${recipe.id}`}
                  className="block"
                >
                  <h3 className="font-semibold text-gray-900 hover:text-blue-600 line-clamp-2">
                    {recipe.title}
                  </h3>
                </Link>
                {recipe.isUserSaved && (
                  <div className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex-shrink-0">
                    Saved
                  </div>
                )}
              </div>
              
              <p className="text-gray-600 text-xs mb-2">
                by {recipe.user.name || recipe.user.email}
              </p>
              
              {recipe.description && (
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  {recipe.description}
                </p>
              )}

              {/* Recipe Stats */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex gap-3">
                    {recipe.prepTime && (
                      <span className="flex items-center">
                        <Clock size={10} className="mr-1" />
                        {recipe.prepTime}m
                      </span>
                    )}
                    {recipe.servings && (
                      <span className="flex items-center">
                        <Users size={10} className="mr-1" />
                        {recipe.servings}
                      </span>
                    )}
                  </div>
                </div>
                
                {recipe.averageRating > 0 && (
                  <div className="flex items-center">
                    <StarRating rating={Math.round(recipe.averageRating)} readonly size={12} />
                    <span className="ml-1 text-xs text-gray-500">
                      {recipe.averageRating.toFixed(1)} ({recipe.ratingCount})
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center">
                <Link
                  to={`/community/${recipe.id}`}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  View Recipe
                </Link>
                
                {showSaveButton && !recipe.isUserSaved && (
                  <form method="post" action="/api/community-recipes">
                    <input type="hidden" name="intent" value="save" />
                    <input type="hidden" name="recipeId" value={recipe.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                    >
                      <Heart size={10} className="mr-1" />
                      Save
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dots indicator for mobile */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-4 md:hidden">
          {Array.from({ length: totalPages }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full mx-1 ${
                currentIndex === index ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}