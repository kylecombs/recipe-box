import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { ChefHat, Link as LinkIcon, Utensils } from "lucide-react";

export const meta: MetaFunction = () => {
  return [
    { title: "Recipe App - Import & Organize Your Recipes" },
    { name: "description", content: "Import recipes from websites and organize your cooking collection" },
  ];
};

export default function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <ChefHat size={64} className="text-blue-600" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Recipe Organizer
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Import recipes from your favorite cooking websites and organize them in one beautiful place
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center mb-4">
              <LinkIcon className="text-green-600 mr-3" size={32} />
              <h2 className="text-2xl font-bold text-gray-900">Import from URLs</h2>
            </div>
            <p className="text-gray-600 mb-6">
              Paste any recipe URL and we&apos;ll automatically extract the ingredients, instructions, and cooking times.
            </p>
            <Link
              to="/login"
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 inline-block"
            >
              Start Importing
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center mb-4">
              <Utensils className="text-blue-600 mr-3" size={32} />
              <h2 className="text-2xl font-bold text-gray-900">Organize & Cook</h2>
            </div>
            <p className="text-gray-600 mb-6">
              Keep all your recipes organized with tags, create grocery lists, and access them anywhere.
            </p>
            <Link
              to="/login"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 inline-block"
            >
              Get Organized
            </Link>
          </div>
        </div>

        <div className="text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Supported Recipe Sites
          </h3>
          <p className="text-gray-600 mb-8">
            Works with AllRecipes, Food Network, NYT Cooking, and hundreds of other recipe websites
          </p>
          <Link
            to="/login"
            className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:from-blue-700 hover:to-green-700 inline-block"
          >
            Try It Now - Free Demo
          </Link>
        </div>
      </div>
    </div>
  );
}
