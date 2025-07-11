// app/routes/recipes/import.tsx
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { Link } from "lucide-react";
import { db } from "~/utils/db.server";
import { requireUserId } from "~/utils/auth.server";
import { parseRecipeFromUrl } from "~/utils/recipe-parser.server";

export const loader = async ({ request }) => {
  // Ensure user is authenticated
  await requireUserId(request);
  return json({});
};

export const action = async ({ request }) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const url = formData.get("url");
  
  if (!url) {
    return json({ error: "URL is required" }, { status: 400 });
  }
  
  try {
    // Parse recipe from URL
    const recipeData = await parseRecipeFromUrl(url.toString());
    
    if (!recipeData) {
      return json({ 
        error: "Could not extract recipe information from this URL. Try a different URL or manual entry." 
      }, { status: 400 });
    }
    
    // Save recipe to database using Prisma
    const recipe = await db.recipe.create({
      data: {
        title: recipeData.title,
        description: recipeData.description,
        sourceUrl: url.toString(),
        imageUrl: recipeData.imageUrl,
        prepTime: recipeData.prepTimeMinutes,
        cookTime: recipeData.cookTimeMinutes,
        servings: recipeData.servings,
        userId: userId,
        ingredients: {
          create: recipeData.ingredients.map(ing => ({
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            notes: ing.notes
          }))
        },
        instructions: {
          create: recipeData.instructions.map((step, index) => ({
            stepNumber: index + 1,
            description: step
          }))
        },
        tags: {
          create: recipeData.tags.map(tagName => ({
            tag: {
              connectOrCreate: {
                where: { name: tagName },
                create: { name: tagName }
              }
            }
          }))
        }
      }
    });
    
    // Redirect to the new recipe page
    return redirect(`/recipes/${recipe.id}`);
  } catch (error) {
    console.error("Error importing recipe:", error);
    return json({ 
      error: "Failed to import recipe. Please try again or enter it manually." 
    }, { status: 500 });
  }
};

export default function ImportRecipe() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [url, setUrl] = useState("");
  
  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Import Recipe from URL</h1>
      
      <Form method="post" className="space-y-6">
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
            Recipe URL
          </label>
          <div className="flex">
            <input
              type="url"
              name="url"
              id="url"
              required
              placeholder="https://example.com/recipe"
              className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button 
              type="submit"
              disabled={isSubmitting || !url}
              className="bg-blue-600 text-white px-4 py-2 rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isSubmitting ? "Importing..." : "Import"}
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Paste a URL from a popular recipe website
          </p>
        </div>
        
        {actionData?.error && (
          <div className="text-red-600 text-sm">
            {actionData.error}
          </div>
        )}
        
        <div className="flex items-center space-x-2 text-sm">
          <Link size={16} className="text-gray-500" />
          <span className="text-gray-500">
            Supported sites: AllRecipes, Food Network, NYT Cooking, and more
          </span>
        </div>
        
        <div className="pt-4 border-t flex justify-between">
          <a 
            href="/recipes/new" 
            className="text-blue-600 hover:text-blue-800"
          >
            Enter recipe manually instead
          </a>
          <a 
            href="/recipes" 
            className="text-gray-600 hover:text-gray-800"
          >
            Back to recipes
          </a>
        </div>
      </Form>
    </div>
  );
}