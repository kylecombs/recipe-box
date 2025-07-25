import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { useState, useEffect } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { db } from "~/utils/db.server";
import { requireUserId } from "~/utils/auth.server";
import Toast from "~/components/Toast";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();

  const title = formData.get("title")?.toString().trim();
  const description = formData.get("description")?.toString().trim();
  const imageUrl = formData.get("imageUrl")?.toString().trim();
  const prepTime = formData.get("prepTime")?.toString();
  const cookTime = formData.get("cookTime")?.toString();
  const servings = formData.get("servings")?.toString();
  
  const ingredientNames = formData.getAll("ingredientName").map(name => name.toString().trim());
  const ingredientQuantities = formData.getAll("ingredientQuantity").map(qty => qty.toString().trim());
  const ingredientUnits = formData.getAll("ingredientUnit").map(unit => unit.toString().trim());
  const ingredientNotes = formData.getAll("ingredientNotes").map(note => note.toString().trim());
  
  const instructions = formData.getAll("instruction").map(inst => inst.toString().trim()).filter(Boolean);

  if (!title) {
    return json({ error: "Recipe title is required" }, { status: 400 });
  }

  if (ingredientNames.length === 0 || ingredientNames.every(name => !name)) {
    return json({ error: "At least one ingredient is required" }, { status: 400 });
  }

  if (instructions.length === 0) {
    return json({ error: "At least one instruction step is required" }, { status: 400 });
  }

  try {
    const ingredients = ingredientNames
      .map((name, index) => {
        if (!name) return null;
        return {
          name,
          quantity: ingredientQuantities[index] || null,
          unit: ingredientUnits[index] || null,
          notes: ingredientNotes[index] || null,
          original: `${ingredientQuantities[index] || ''} ${ingredientUnits[index] || ''} ${name}`.trim(),
        };
      })
      .filter((ingredient): ingredient is NonNullable<typeof ingredient> => Boolean(ingredient));

    const recipe = await db.recipe.create({
      data: {
        title,
        description: description || null,
        imageUrl: imageUrl || null,
        prepTime: prepTime ? parseInt(prepTime, 10) : null,
        cookTime: cookTime ? parseInt(cookTime, 10) : null,
        servings: servings ? parseInt(servings, 10) : null,
        sourceUrl: null,
        instructions: instructions.join('\n'),
        userId,
        version: 1,
        ingredients: {
          create: ingredients,
        },
        instructionSteps: {
          create: instructions.map((instruction, index) => ({
            stepNumber: index + 1,
            description: instruction,
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
    console.error("Error creating recipe:", error);
    return json({ error: "Failed to create recipe. Please try again." }, { status: 500 });
  }
}

export default function NewRecipe() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [ingredients, setIngredients] = useState([
    { name: "", quantity: "", unit: "", notes: "" }
  ]);
  const [instructions, setInstructions] = useState([""]);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (actionData?.error) {
      setShowToast(true);
    }
  }, [actionData]);

  const addIngredient = () => {
    setIngredients([...ingredients, { name: "", quantity: "", unit: "", notes: "" }]);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index));
    }
  };

  const updateIngredient = (index: number, field: string, value: string) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };

  const addInstruction = () => {
    setInstructions([...instructions, ""]);
  };

  const removeInstruction = (index: number) => {
    if (instructions.length > 1) {
      setInstructions(instructions.filter((_, i) => i !== index));
    }
  };

  const updateInstruction = (index: number, value: string) => {
    const newInstructions = [...instructions];
    newInstructions[index] = value;
    setInstructions(newInstructions);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Recipe</h1>
        <p className="text-gray-600">Add your own recipe with ingredients and instructions</p>
      </div>

      <Form method="post" className="space-y-8">
        {/* Basic Recipe Information */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Recipe Details</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="lg:col-span-2">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Recipe Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter recipe name"
              />
            </div>

            <div className="lg:col-span-2">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe your recipe (optional)"
              />
            </div>

            <div>
              <label htmlFor="prepTime" className="block text-sm font-medium text-gray-700 mb-2">
                Prep Time (minutes)
              </label>
              <input
                type="number"
                id="prepTime"
                name="prepTime"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>

            <div>
              <label htmlFor="cookTime" className="block text-sm font-medium text-gray-700 mb-2">
                Cook Time (minutes)
              </label>
              <input
                type="number"
                id="cookTime"
                name="cookTime"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>

            <div>
              <label htmlFor="servings" className="block text-sm font-medium text-gray-700 mb-2">
                Servings
              </label>
              <input
                type="number"
                id="servings"
                name="servings"
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="4"
              />
            </div>

            <div>
              <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-2">
                Image URL
              </label>
              <input
                type="url"
                id="imageUrl"
                name="imageUrl"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>
        </div>

        {/* Ingredients Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Ingredients</h2>
            <button
              type="button"
              onClick={addIngredient}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Ingredient
            </button>
          </div>

          <div className="space-y-4">
            {ingredients.map((ingredient, index) => (
              <div key={index} className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-2">
                  <input
                    type="text"
                    name="ingredientQuantity"
                    value={ingredient.quantity}
                    onChange={(e) => updateIngredient(index, "quantity", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Qty"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="text"
                    name="ingredientUnit"
                    value={ingredient.unit}
                    onChange={(e) => updateIngredient(index, "unit", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Unit"
                  />
                </div>
                <div className="col-span-4">
                  <input
                    type="text"
                    name="ingredientName"
                    value={ingredient.name}
                    onChange={(e) => updateIngredient(index, "name", e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Ingredient name *"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="text"
                    name="ingredientNotes"
                    value={ingredient.notes}
                    onChange={(e) => updateIngredient(index, "notes", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Notes"
                  />
                </div>
                <div className="col-span-1">
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    disabled={ingredients.length === 1}
                    className="p-2 text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Instructions</h2>
            <button
              type="button"
              onClick={addInstruction}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Step
            </button>
          </div>

          <div className="space-y-4">
            {instructions.map((instruction, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <textarea
                    name="instruction"
                    value={instruction}
                    onChange={(e) => updateInstruction(index, e.target.value)}
                    required
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter instruction step..."
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeInstruction(index)}
                  disabled={instructions.length === 1}
                  className="flex-shrink-0 p-2 text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-5 w-5 mr-2" />
            {isSubmitting ? "Creating Recipe..." : "Create Recipe"}
          </button>
        </div>
      </Form>

      {showToast && actionData?.error && (
        <Toast
          message={actionData.error}
          type="error"
          show={showToast}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}