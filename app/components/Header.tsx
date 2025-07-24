import { useState, useRef, useEffect } from "react";
import { Link, Form } from "@remix-run/react";

interface HeaderProps {
  userId?: string;
}

export function Header({ userId }: HeaderProps) {
  const [isRecipesOpen, setIsRecipesOpen] = useState(false);
  const [isMealPlansOpen, setIsMealPlansOpen] = useState(false);
  const [isCommunityOpen, setIsCommunityOpen] = useState(false);
  const [isGroceryListsOpen, setIsGroceryListsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const recipesRef = useRef<HTMLDivElement>(null);
  const mealPlansRef = useRef<HTMLDivElement>(null);
  const communityRef = useRef<HTMLDivElement>(null);
  const groceryListsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (recipesRef.current && !recipesRef.current.contains(event.target as Node)) {
        setIsRecipesOpen(false);
      }
      if (mealPlansRef.current && !mealPlansRef.current.contains(event.target as Node)) {
        setIsMealPlansOpen(false);
      }
      if (communityRef.current && !communityRef.current.contains(event.target as Node)) {
        setIsCommunityOpen(false);
      }
      if (groceryListsRef.current && !groceryListsRef.current.contains(event.target as Node)) {
        setIsGroceryListsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className="bg-white shadow-md">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="text-2xl font-bold text-gray-900">
                Recipe App
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8 items-center">
              {/* Recipes Dropdown */}
              <div className="relative" ref={recipesRef}>
                <button
                  onClick={() => setIsRecipesOpen(!isRecipesOpen)}
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-gray-700"
                >
                  Recipes
                  <svg
                    className="ml-1 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {isRecipesOpen && (
                  <div className="absolute z-10 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                    <div className="py-1" role="menu">
                      {userId && (
                        <>
                          <Link
                            to="/recipes"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsRecipesOpen(false)}
                          >
                            View My Recipes
                          </Link>
                          <Link
                            to="/recipes/import"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsRecipesOpen(false)}
                          >
                            Import Recipe
                          </Link>
                          <Link
                            to="/recipes/new"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsRecipesOpen(false)}
                          >
                            Manually Add Recipe
                          </Link>
                        </>
                      )}
                      {!userId && (
                        <Link
                          to="/login"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsRecipesOpen(false)}
                        >
                          Login to access recipes
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Meal Plans Dropdown */}
              <div className="relative" ref={mealPlansRef}>
                <button
                  onClick={() => setIsMealPlansOpen(!isMealPlansOpen)}
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-gray-700"
                >
                  Meal Plans
                  <svg
                    className="ml-1 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {isMealPlansOpen && (
                  <div className="absolute z-10 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                    <div className="py-1" role="menu">
                      {userId && (
                        <>
                          <Link
                            to="/meal-plans"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsMealPlansOpen(false)}
                          >
                            View Meal Plans
                          </Link>
                          <Link
                            to="/meal-plans/generate"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsMealPlansOpen(false)}
                          >
                            AI Meal Plan Generator
                          </Link>
                          <Link
                            to="/meal-plans/new"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsMealPlansOpen(false)}
                          >
                            Manually Add Meal Plan
                          </Link>
                        </>
                      )}
                      {!userId && (
                        <Link
                          to="/login"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsMealPlansOpen(false)}
                        >
                          Login to access meal plans
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Grocery Lists Dropdown */}
              <div className="relative" ref={groceryListsRef}>
                <button
                  onClick={() => setIsGroceryListsOpen(!isGroceryListsOpen)}
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-gray-700"
                >
                  Grocery Lists
                  <svg
                    className="ml-1 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {isGroceryListsOpen && (
                  <div className="absolute z-10 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                    <div className="py-1" role="menu">
                      {userId && (
                        <>
                          <Link
                            to="/grocery-lists"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsGroceryListsOpen(false)}
                          >
                            View Grocery Lists
                          </Link>
                          <Link
                            to="/grocery-lists/new"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsGroceryListsOpen(false)}
                          >
                            Create New List
                          </Link>
                        </>
                      )}
                      {!userId && (
                        <Link
                          to="/login"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsGroceryListsOpen(false)}
                        >
                          Login to access grocery lists
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Community Dropdown */}
              <div className="relative" ref={communityRef}>
                <button
                  onClick={() => setIsCommunityOpen(!isCommunityOpen)}
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-gray-700"
                >
                  Community
                  <svg
                    className="ml-1 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {isCommunityOpen && (
                  <div className="absolute z-10 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                    <div className="py-1" role="menu">
                      <Link
                        to="/community/recipes"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsCommunityOpen(false)}
                      >
                        Community Recipes
                      </Link>
                      <Link
                        to="/community/meal-plans"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsCommunityOpen(false)}
                      >
                        Community Meal Plans
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Auth section */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-4">
            {userId ? (
              <Form method="post" action="/logout">
                <button
                  type="submit"
                  className="text-sm font-medium text-gray-900 hover:text-gray-700"
                >
                  Log out
                </button>
              </Form>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-gray-900 hover:text-gray-700"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={
                    isMobileMenuOpen
                      ? "M6 18L18 6M6 6l12 12"
                      : "M4 6h16M4 12h16M4 18h16"
                  }
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="sm:hidden">
            <div className="pt-2 pb-3 space-y-1">
              {/* Recipes Section */}
              <div className="border-t border-gray-200 pt-2">
                <div className="px-4 py-2 text-base font-medium text-gray-900">
                  Recipes
                </div>
                {userId && (
                  <div className="pl-8 space-y-1">
                    <Link
                      to="/recipes"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      View My Recipes
                    </Link>
                    <Link
                      to="/recipes/import"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Import Recipe
                    </Link>
                    <Link
                      to="/recipes/new"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Manually Add Recipe
                    </Link>
                  </div>
                )}
              </div>

              {/* Meal Plans Section */}
              <div className="border-t border-gray-200 pt-2">
                <div className="px-4 py-2 text-base font-medium text-gray-900">
                  Meal Plans
                </div>
                {userId && (
                  <div className="pl-8 space-y-1">
                    <Link
                      to="/meal-plans"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      View Meal Plans
                    </Link>
                    <Link
                      to="/meal-plans/generate"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      AI Meal Plan Generator
                    </Link>
                    <Link
                      to="/meal-plans/new"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Manually Add Meal Plan
                    </Link>
                  </div>
                )}
              </div>

              {/* Grocery Lists Section */}
              <div className="border-t border-gray-200 pt-2">
                <div className="px-4 py-2 text-base font-medium text-gray-900">
                  Grocery Lists
                </div>
                {userId && (
                  <div className="pl-8 space-y-1">
                    <Link
                      to="/grocery-lists"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      View Grocery Lists
                    </Link>
                    <Link
                      to="/grocery-lists/new"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Create New List
                    </Link>
                  </div>
                )}
              </div>

              {/* Community Section */}
              <div className="border-t border-gray-200 pt-2">
                <div className="px-4 py-2 text-base font-medium text-gray-900">
                  Community
                </div>
                <div className="pl-8 space-y-1">
                  <Link
                    to="/recipes"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Community Recipes
                  </Link>
                  <Link
                    to="/community/meal-plans"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Community Meal Plans
                  </Link>
                </div>
              </div>

              {/* Auth Section */}
              <div className="border-t border-gray-200 pt-4 pb-3">
                {userId ? (
                  <Form method="post" action="/logout">
                    <button
                      type="submit"
                      className="block w-full text-left px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Log out
                    </button>
                  </Form>
                ) : (
                  <div className="space-y-1">
                    <Link
                      to="/login"
                      className="block px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Log in
                    </Link>
                    <Link
                      to="/signup"
                      className="block px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Sign up
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}