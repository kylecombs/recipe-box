// app/routes/recipes/import.tsx
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { useState, useCallback } from "react";
import { Link, Camera } from "lucide-react";
import { db } from "~/utils/db.server";
import { requireUserId } from "~/utils/auth.server";
import { parseRecipeFromImage, validateImageBuffer } from "~/utils/image-processor.server";
import { importRecipeWithVersioning, associateUserWithRecipe } from "~/utils/recipe-versioning.server";

import type { LoaderFunction, ActionFunction } from "@remix-run/node";

export const loader: LoaderFunction = async ({ request }) => {
  // Ensure user is authenticated
  await requireUserId(request);
  return json({});
};

export const action: ActionFunction = async ({ request }) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const url = formData.get("url");
  const imageFile = formData.get("image") as File;
  
  // Handle URL import
  if (url) {
    try {
      // Import recipe with versioning support
      const { recipe, isNewVersion } = await importRecipeWithVersioning(url.toString(), userId);
      
      // Associate the user with this recipe version
      await associateUserWithRecipe(userId, recipe.id);
      
      // Redirect to the recipe page with a message about versioning
      const redirectUrl = isNewVersion 
        ? `/recipes/${recipe.id}?newVersion=true`
        : `/recipes/${recipe.id}`;
      
      return redirect(redirectUrl);
    } catch (error) {
      console.error("Error importing recipe:", error);
      return json({ 
        error: error instanceof Error ? error.message : "Failed to import recipe. Please try again or enter it manually." 
      }, { status: 500 });
    }
  }
  
  // Handle image import
  if (imageFile && imageFile instanceof File) {
    try {
      // Convert file to buffer
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Validate image
      const isValidImage = await validateImageBuffer(buffer);
      if (!isValidImage) {
        return json({ error: "Invalid image file" }, { status: 400 });
      }
      
      // Check file size (limit to 10MB)
      if (buffer.length > 10 * 1024 * 1024) {
        return json({ error: "Image file too large. Maximum size is 10MB" }, { status: 400 });
      }
      
      // Process the image and extract recipe data
      const recipeData = await parseRecipeFromImage(buffer);
      
      // Create the recipe in the database
      const recipe = await db.recipe.create({
        data: {
          title: recipeData.title,
          description: recipeData.description,
          imageUrl: recipeData.imageUrl,
          prepTime: recipeData.prepTimeMinutes,
          cookTime: recipeData.cookTimeMinutes,
          servings: recipeData.servings,
          sourceUrl: null,
          instructions: recipeData.instructions.join('\n'),
          userId,
          version: 1,
          ingredients: {
            create: recipeData.ingredients.map((ing) => ({
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
              notes: ing.notes,
            })),
          },
          instructionSteps: {
            create: recipeData.instructions.map((instruction, index) => ({
              stepNumber: index + 1,
              description: instruction,
            })),
          },
          tags: {
            create: recipeData.tags.map(tagName => ({
              tag: {
                connectOrCreate: {
                  where: { name: tagName },
                  create: { name: tagName }
                }
              }
            })),
          },
          userRecipes: {
            create: {
              userId,
            },
          },
        },
      });
      
      return redirect(`/recipes/${recipe.id}`);
    } catch (error) {
      console.error("Error parsing recipe from image:", error);
      
      if (error instanceof Error && error.message === "Image quality is too low for reliable text extraction") {
        return json({ error: "Image quality is too low. Please try a clearer image." }, { status: 400 });
      }
      
      return json({ 
        error: "Failed to parse recipe from image. Please try again or enter manually." 
      }, { status: 500 });
    }
  }
  
  return json({ error: "Please provide either a URL or an image" }, { status: 400 });
};

type ActionData = {
  error?: string;
};

export default function ImportRecipe() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [url, setUrl] = useState("");
  const [importMethod, setImportMethod] = useState<"url" | "image">("url");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);
  
  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Import Recipe</h1>
      
      {/* Tab buttons */}
      <div className="flex mb-6 border-b">
        <button
          type="button"
          onClick={() => setImportMethod("url")}
          className={`flex-1 py-2 px-4 text-center ${
            importMethod === "url"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          <Link size={20} className="inline-block mb-1" />
          <div>From URL</div>
        </button>
        <button
          type="button"
          onClick={() => setImportMethod("image")}
          className={`flex-1 py-2 px-4 text-center ${
            importMethod === "image"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          <Camera size={20} className="inline-block mb-1" />
          <div>From Image</div>
        </button>
      </div>
      
      {importMethod === "url" ? (
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
        </Form>
      ) : (
        <Form method="post" encType="multipart/form-data" className="space-y-6">
          <div>
            <label htmlFor="image-input" className="block text-sm font-medium text-gray-700 mb-1">
              Recipe Image
            </label>
            <input
              id="image-input"
              type="file"
              name="image"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
            />
            <p className="mt-2 text-sm text-gray-500">
              Upload a photo of a recipe from a cookbook or magazine
            </p>
          </div>
          
          {imagePreview && (
            <div className="mt-4">
              <img 
                src={imagePreview} 
                alt="Recipe preview" 
                className="max-w-full h-auto rounded-lg shadow-md"
              />
            </div>
          )}
          
          <button 
            type="submit"
            disabled={isSubmitting || !selectedFile}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isSubmitting ? "Processing Image..." : "Extract Recipe"}
          </button>
          
          {actionData?.error && (
            <div className="text-red-600 text-sm">
              {actionData.error}
            </div>
          )}
          
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Camera size={16} />
            <span>
              Best results with clear, well-lit photos of recipe text
            </span>
          </div>
        </Form>
      )}
      
      <div className="pt-4 mt-6 border-t flex justify-between">
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
    </div>
  );
}