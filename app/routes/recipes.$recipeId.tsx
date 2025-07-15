import { json, LoaderFunctionArgs, ActionFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Link, Form, useActionData, useNavigation } from "@remix-run/react";
import { ArrowLeft, Clock, Users, ExternalLink, Edit2, Save, X, Plus, Trash2, Upload, StickyNote, AlertTriangle, ShoppingCart } from "lucide-react";
import { useState, useEffect } from "react";
import { db } from "~/utils/db.server";
import { requireUserId } from "~/utils/auth.server";
import { areIngredientsEqual, combineQuantities, getCanonicalIngredientName } from "~/utils/ingredient-matcher.server";
import IngredientsList from "~/components/IngredientsList";
import InstructionsList from "~/components/InstructionsList";
import TagsList from "~/components/TagsList";
import Toast from "~/components/Toast";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const recipeId = params.recipeId;

  if (!recipeId) {
    throw new Response("Recipe not found", { status: 404 });
  }

  const recipe = await db.recipe.findFirst({
    where: {
      id: recipeId,
      userId: userId,
    },
    include: {
      ingredients: {
        orderBy: { createdAt: "asc" },
      },
      instructions: {
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

  // Also fetch user's grocery lists
  const groceryLists = await db.groceryList.findMany({
    where: { userId },
    include: { items: true }
  });

  // Fetch notes separately
  const notes = await (db as any).note.findMany({
    where: { recipeId },
    orderBy: { createdAt: 'desc' }
  });

  return json({ recipe, groceryLists, notes });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const recipeId = params.recipeId;

  if (!recipeId) {
    throw new Response("Recipe not found", { status: 404 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "addNote") {
    const noteText = formData.get("noteText")?.toString();
    
    if (!noteText?.trim()) {
      return json({ error: "Note cannot be empty" }, { status: 400 });
    }
    
    try {
      const existingRecipe = await db.recipe.findFirst({
        where: { id: recipeId, userId },
        include: {
          ingredients: true,
          instructions: true,
          tags: { include: { tag: true } },
        }
      });

      if (!existingRecipe) {
        throw new Response("Recipe not found", { status: 404 });
      }

      // Add new note using Prisma
      await (db as any).note.create({
        data: {
          text: noteText.trim(),
          recipeId: recipeId
        }
      });

      return json({ success: true, quickNote: true });
    } catch (error) {
      console.error("Error adding note:", error);
      return json({ error: "Failed to add note" }, { status: 500 });
    }
  }
  
  if (intent === "deleteNote") {
    const noteId = formData.get("noteId")?.toString();
    
    try {
      const existingRecipe = await db.recipe.findFirst({
        where: { id: recipeId, userId },
        include: {
          ingredients: true,
          instructions: true,
          tags: { include: { tag: true } },
        }
      });

      if (!existingRecipe) {
        throw new Response("Recipe not found", { status: 404 });
      }

      // Remove the note using Prisma
      await (db as any).note.delete({
        where: { id: noteId }
      });

      return json({ success: true, deleteNote: true });
    } catch (error) {
      console.error("Error deleting note:", error);
      return json({ error: "Failed to delete note" }, { status: 500 });
    }
  }
  
  if (intent === "deleteRecipe") {
    try {
      const deletedRecipe = await db.recipe.delete({
        where: { id: recipeId, userId }
      });

      if (!deletedRecipe) {
        throw new Response("Recipe not found", { status: 404 });
      }

      return redirect("/recipes");
    } catch (error) {
      console.error("Error deleting recipe:", error);
      return json({ error: "Failed to delete recipe" }, { status: 500 });
    }
  }
  
  if (intent === "addToGroceryList") {
    const groceryListId = formData.get("groceryListId")?.toString();
    const newListName = formData.get("newListName")?.toString();
    
    try {
      const recipe = await db.recipe.findFirst({
        where: { id: recipeId, userId },
        include: {
          ingredients: true,
          instructions: true,
          tags: { include: { tag: true } },
        }
      });

      if (!recipe) {
        throw new Response("Recipe not found", { status: 404 });
      }

      let targetListId = groceryListId;
      
      // Create new list if requested
      if (!groceryListId && newListName?.trim()) {
        const newList = await db.groceryList.create({
          data: {
            name: newListName.trim(),
            userId
          }
        });
        targetListId = newList.id;
      }
      
      if (!targetListId) {
        return json({ error: "No grocery list selected" }, { status: 400 });
      }

      // Get the target grocery list
      const groceryList = await db.groceryList.findFirst({
        where: { id: targetListId, userId },
        include: { items: true }
      });

      if (!groceryList) {
        return json({ error: "Grocery list not found" }, { status: 404 });
      }

      // Combine recipe ingredients with existing grocery list items
      const existingItems = groceryList.items || [];
      
      // Convert existing items to the format needed for createMany
      const newItems = existingItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        checked: item.checked,
        groceryListId: targetListId
      }));

      // Add recipe ingredients
      for (const ingredient of recipe.ingredients) {
        // Skip common pantry staples like salt and pepper
        const canonicalName = getCanonicalIngredientName(ingredient.name);
        const originalName = ingredient.name.toLowerCase();
        const saltPepperVariants = [
          'salt', 'pepper', 'black pepper', 'white pepper', 'sea salt', 'kosher salt', 'table salt',
          'freshly ground pepper', 'freshly ground black pepper', 'ground pepper', 'ground black pepper',
          'cracked pepper', 'cracked black pepper', 'fine salt', 'coarse salt', 'rock salt'
        ];
        
        if (saltPepperVariants.some(variant => 
          canonicalName.toLowerCase() === variant || 
          originalName.includes(variant)
        )) {
          continue;
        }

        // Find existing item using intelligent matching
        const existingItemIndex = newItems.findIndex(
          item => areIngredientsEqual(item.name, ingredient.name)
        );

        if (existingItemIndex >= 0) {
          // Combine with existing item - use basic combination for now
          const existingItem = newItems[existingItemIndex];
          const combinedResult = combineQuantities(
            existingItem.quantity,
            existingItem.unit,
            ingredient.quantity,
            ingredient.unit,
            existingItem.name,
            ingredient.name
          );
          
          // Update existing item
          newItems[existingItemIndex] = {
            ...existingItem,
            name: canonicalName,
            quantity: combinedResult.quantity,
            unit: combinedResult.unit
          };
        } else {
          // Add new item
          newItems.push({
            name: canonicalName,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            checked: false,
            groceryListId: targetListId
          });
        }
      }

      // Delete existing items and create new ones
      await db.groceryListItem.deleteMany({
        where: { groceryListId: targetListId }
      });
      
      // Create new items
      if (newItems.length > 0) {
        await db.groceryListItem.createMany({
          data: newItems
        });
      }

      return json({ 
        success: true, 
        addedToGroceryList: true,
        groceryListName: groceryList.name 
      });
    } catch (error) {
      console.error("Error adding to grocery list:", error);
      return json({ error: "Failed to add to grocery list" }, { status: 500 });
    }
  }
  
  if (intent === "update") {
    const title = formData.get("title")?.toString();
    const description = formData.get("description")?.toString();
    const prepTime = formData.get("prepTime")?.toString();
    const cookTime = formData.get("cookTime")?.toString();
    const servings = formData.get("servings")?.toString();
    const imageUrl = formData.get("imageUrl")?.toString();
    
    // Parse ingredients
    const ingredientNames = formData.getAll("ingredientName");
    const ingredientQuantities = formData.getAll("ingredientQuantity");
    const ingredientUnits = formData.getAll("ingredientUnit");
    const ingredientNotes = formData.getAll("ingredientNotes");
    
    const ingredients = ingredientNames.map((name, index) => ({
      id: `ing-${Date.now()}-${index}`,
      name: name.toString(),
      quantity: ingredientQuantities[index]?.toString() || null,
      unit: ingredientUnits[index]?.toString() || null,
      notes: ingredientNotes[index]?.toString() || null,
      recipeId: recipeId,
      createdAt: new Date(),
      updatedAt: new Date()
    })).filter(ing => ing.name.trim() !== '');
    
    // Parse instructions
    const instructionTexts = formData.getAll("instruction");
    const instructions = instructionTexts
      .map((text, index) => ({
        id: `inst-${Date.now()}-${index}`,
        stepNumber: index + 1,
        description: text.toString(),
        recipeId: recipeId,
        createdAt: new Date(),
        updatedAt: new Date()
      }))
      .filter(inst => inst.description.trim() !== '');

    if (!title) {
      return json({ error: "Title is required" }, { status: 400 });
    }

    try {
      // Update the recipe using Prisma
      const existingRecipe = await db.recipe.findFirst({
        where: { id: recipeId, userId },
        include: {
          ingredients: true,
          instructions: true,
          tags: { include: { tag: true } },
        }
      });

      if (!existingRecipe) {
        throw new Response("Recipe not found", { status: 404 });
      }

      // Update the recipe using Prisma
      await db.recipe.update({
        where: { id: recipeId },
        data: {
          title,
          description: description || null,
          prepTime: prepTime ? parseInt(prepTime) : null,
          cookTime: cookTime ? parseInt(cookTime) : null,
          servings: servings ? parseInt(servings) : null,
          imageUrl: imageUrl || null,
        }
      });
      
      // Delete existing ingredients and instructions, then recreate them
      await db.ingredient.deleteMany({
        where: { recipeId }
      });
      
      await db.instruction.deleteMany({
        where: { recipeId }
      });
      
      // Create new ingredients
      if (ingredients.length > 0) {
        await db.ingredient.createMany({
          data: ingredients.map(ing => ({
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            notes: ing.notes,
            recipeId: recipeId
          }))
        });
      }
      
      // Create new instructions
      if (instructions.length > 0) {
        await db.instruction.createMany({
          data: instructions.map(inst => ({
            stepNumber: inst.stepNumber,
            description: inst.description,
            recipeId: recipeId
          }))
        });
      }

      return json({ success: true });
    } catch (error) {
      console.error("Error updating recipe:", error);
      return json({ error: "Failed to update recipe" }, { status: 500 });
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

export default function RecipeDetail() {
  const { recipe, groceryLists, notes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [isEditing, setIsEditing] = useState(false);
  const isSubmitting = navigation.state === "submitting";
  
  // Initialize ingredients and instructions state for editing
  const [editableIngredients, setEditableIngredients] = useState(recipe.ingredients);
  const [editableInstructions, setEditableInstructions] = useState(recipe.instructions);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showGroceryListModal, setShowGroceryListModal] = useState(false);
  const [selectedGroceryListId, setSelectedGroceryListId] = useState<string>('');
  const [newGroceryListName, setNewGroceryListName] = useState('');

  // Handle action responses
  useEffect(() => {
    if (actionData && !isSubmitting) {
      if ('success' in actionData && actionData.success) {
        if ('quickNote' in actionData && actionData.quickNote) {
          setIsAddingNote(false);
          setToast({ message: 'Note added!', type: 'success' });
        } else if ('deleteNote' in actionData && actionData.deleteNote) {
          setToast({ message: 'Note deleted!', type: 'success' });
        } else if ('addedToGroceryList' in actionData && actionData.addedToGroceryList) {
          setShowGroceryListModal(false);
          setSelectedGroceryListId('');
          setNewGroceryListName('');
          const listName = 'groceryListName' in actionData ? actionData.groceryListName : 'grocery list';
          setToast({ message: `Ingredients added to ${listName}!`, type: 'success' });
        } else {
          setIsEditing(false);
          setToast({ message: 'Recipe updated successfully!', type: 'success' });
        }
      } else if ('error' in actionData && actionData.error) {
        setToast({ message: actionData.error, type: 'error' });
      }
    }
  }, [actionData, isSubmitting]);
  
  // Reset editable data when entering/exiting edit mode
  useEffect(() => {
    if (isEditing) {
      setEditableIngredients(recipe.ingredients);
      setEditableInstructions(recipe.instructions);
    } else {
      setImagePreview(null);
    }
  }, [isEditing, recipe.ingredients, recipe.instructions]);
  
  const addIngredient = () => {
    setEditableIngredients([...editableIngredients, {
      id: `temp-ing-${Date.now()}`,
      name: '',
      quantity: null,
      unit: null,
      notes: null,
      recipeId: recipe.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]);
  };
  
  const removeIngredient = (index: number) => {
    setEditableIngredients(editableIngredients.filter((_, i) => i !== index));
  };
  
  const addInstruction = () => {
    setEditableInstructions([...editableInstructions, {
      id: `temp-inst-${Date.now()}`,
      stepNumber: editableInstructions.length + 1,
      description: '',
      recipeId: recipe.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]);
  };
  
  const removeInstruction = (index: number) => {
    const filtered = editableInstructions.filter((_, i) => i !== index);
    // Renumber steps
    filtered.forEach((inst, i) => {
      inst.stepNumber = i + 1;
    });
    setEditableInstructions(filtered);
  };
  
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // In a real app, you would upload to a server/cloud storage
      // For this demo, we'll use a local data URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <Link 
            to="/recipes" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Recipes
          </Link>
          
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {isEditing ? (
                <>
                  <X size={16} className="mr-2" />
                  Cancel
                </>
              ) : (
                <>
                  <Edit2 size={16} className="mr-2" />
                  Edit Recipe
                </>
              )}
            </button>
            
            {!isEditing && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50"
              >
                <Trash2 size={16} className="mr-2" />
                Delete
              </button>
            )}
          </div>
        </div>
        
        {isEditing ? (
          <Form method="post" className="space-y-6">
            <input type="hidden" name="intent" value="update" />
            
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                {(imagePreview || recipe.imageUrl) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {imagePreview ? 'New Image Preview' : 'Current Image'}
                    </label>
                    <img
                      src={imagePreview || recipe.imageUrl || ''}
                      alt={recipe.title}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={() => setImagePreview(null)}
                        className="mt-2 text-sm text-red-600 hover:text-red-800"
                      >
                        Remove new image
                      </button>
                    )}
                  </div>
                )}
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-1">
                      Image URL
                    </label>
                    <input
                      type="url"
                      name="imageUrl"
                      id="imageUrl"
                      defaultValue={imagePreview || recipe.imageUrl || ''}
                      value={imagePreview || undefined}
                      onChange={(e) => setImagePreview(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <div className="block text-sm font-medium text-gray-700 mb-1">
                      Or Upload Image
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200">
                        <Upload size={16} className="mr-2" />
                        Choose File
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                      <span className="text-sm text-gray-500">
                        {imagePreview && !imagePreview.startsWith('http') ? 'Image selected' : 'No file chosen'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4 h-full">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    Recipe Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    id="title"
                    required
                    defaultValue={recipe.title}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1 h-full">
                    Description
                  </label>
                  <textarea
                    name="description"
                    id="description"
                    rows={3}
                    defaultValue={recipe.description || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="prepTime" className="block text-sm font-medium text-gray-700 mb-1">
                      Prep Time (min)
                    </label>
                    <input
                      type="number"
                      name="prepTime"
                      id="prepTime"
                      min="0"
                      defaultValue={recipe.prepTime || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="cookTime" className="block text-sm font-medium text-gray-700 mb-1">
                      Cook Time (min)
                    </label>
                    <input
                      type="number"
                      name="cookTime"
                      id="cookTime"
                      min="0"
                      defaultValue={recipe.cookTime || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="servings" className="block text-sm font-medium text-gray-700 mb-1">
                      Servings
                    </label>
                    <input
                      type="number"
                      name="servings"
                      id="servings"
                      min="1"
                      defaultValue={recipe.servings || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Editable Ingredients */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Ingredients</h3>
                <button
                  type="button"
                  onClick={addIngredient}
                  className="inline-flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <Plus size={16} className="mr-1" />
                  Add Ingredient
                </button>
              </div>
              
              <div className="space-y-3">
                {editableIngredients.map((ingredient, index) => (
                  <div key={ingredient.id} className="grid grid-cols-12 gap-2 items-start">
                    <input
                      type="text"
                      name="ingredientQuantity"
                      placeholder="Qty"
                      defaultValue={ingredient.quantity || ''}
                      className="col-span-2 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <input
                      type="text"
                      name="ingredientUnit"
                      placeholder="Unit"
                      defaultValue={ingredient.unit || ''}
                      className="col-span-2 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <input
                      type="text"
                      name="ingredientName"
                      placeholder="Ingredient name"
                      required
                      defaultValue={ingredient.name}
                      className="col-span-5 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <input
                      type="text"
                      name="ingredientNotes"
                      placeholder="Notes"
                      defaultValue={ingredient.notes || ''}
                      className="col-span-2 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeIngredient(index)}
                      className="col-span-1 p-1 text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Editable Instructions */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Instructions</h3>
                <button
                  type="button"
                  onClick={addInstruction}
                  className="inline-flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <Plus size={16} className="mr-1" />
                  Add Step
                </button>
              </div>
              
              <div className="space-y-3">
                {editableInstructions.map((instruction, index) => (
                  <div key={instruction.id} className="flex gap-2 items-start">
                    <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1">
                      {instruction.stepNumber}
                    </span>
                    <textarea
                      name="instruction"
                      placeholder="Enter instruction step..."
                      required
                      defaultValue={instruction.description}
                      rows={4}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm resize-y"
                    />
                    <button
                      type="button"
                      onClick={() => removeInstruction(index)}
                      className="p-1 text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={16} className="mr-2" />
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
              
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </Form>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Recipe Image */}
            {recipe.imageUrl && (
              <div className="lg:w-1/3">
                <img
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  className="w-full h-64 lg:h-80 object-cover rounded-lg shadow-lg"
                />
              </div>
            )}
            
            {/* Recipe Info */}
            <div className={recipe.imageUrl ? "lg:w-2/3" : "w-full"}>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">{recipe.title}</h1>
              
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
              
              {/* Source URL */}
              {recipe.sourceUrl && (
                <div className="mb-4">
                  <a 
                    href={recipe.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink size={16} className="mr-1" />
                    View Original Recipe
                  </a>
                </div>
              )}
              
              {/* Tags */}
              {recipe.tags.length > 0 && (
                <TagsList tags={recipe.tags.map(rt => rt.tag.name)} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recipe Content - Only show when not editing */}
      {!isEditing && (
        <>
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Ingredients */}
            <div className="lg:col-span-1">
              <div className="mb-4 space-y-4">
                <IngredientsList ingredients={recipe.ingredients} />
                  <button
                    onClick={() => setShowGroceryListModal(true)}
                    className="inline-flex items-center px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                  >
                    <ShoppingCart size={16} className="mr-2" />
                    Add to Grocery List
                  </button>
              </div>
            </div>
            
            {/* Instructions */}
            <div className="lg:col-span-2">
              <InstructionsList instructions={recipe.instructions} />
            </div>
          </div>
          
          {/* Notes Section */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
              <button
                onClick={() => setIsAddingNote(true)}
                className="inline-flex items-center px-3 py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700"
              >
                <Plus size={16} className="mr-2" />
                Add Note
              </button>
            </div>
            
            {/* Add Note Form */}
            {isAddingNote && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <Form method="post" className="space-y-4">
                  <input type="hidden" name="intent" value="addNote" />
                  <textarea
                    name="noteText"
                    rows={3}
                    placeholder="Add your note here..."
                    className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 disabled:opacity-50"
                    >
                      <Save size={14} className="mr-1" />
                      {isSubmitting ? 'Adding...' : 'Add Note'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingNote(false)}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </Form>
              </div>
            )}
            
            {/* Notes List */}
            {notes && notes.length > 0 ? (
              <div className="space-y-3">
                {notes.map((note: any) => (
                    <div key={note.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <p className="text-gray-700 whitespace-pre-wrap">{note.text}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            {new Date(note.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <Form method="post" className="flex-shrink-0">
                          <input type="hidden" name="intent" value="deleteNote" />
                          <input type="hidden" name="noteId" value={note.id} />
                          <button
                            type="submit"
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Delete note"
                          >
                            <Trash2 size={16} />
                          </button>
                        </Form>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <StickyNote size={48} className="mx-auto mb-2 text-gray-300" />
                <p>No notes yet. Click &ldquo;Add Note&rdquo; to get started!</p>
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center mb-4">
              <AlertTriangle size={24} className="text-red-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Delete Recipe</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete &ldquo;{recipe.title}&rdquo;? This action cannot be undone.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              
              <Form method="post">
                <input type="hidden" name="intent" value="deleteRecipe" />
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                  <Trash2 size={16} className="mr-2" />
                  Delete Recipe
                </button>
              </Form>
            </div>
          </div>
        </div>
      )}
      
      {/* Grocery List Modal */}
      {showGroceryListModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center mb-4">
              <ShoppingCart size={24} className="text-green-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Add to Grocery List</h3>
            </div>
            
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="addToGroceryList" />
              
              {groceryLists.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select existing list:
                  </label>
                  <select
                    name="groceryListId"
                    value={selectedGroceryListId}
                    onChange={(e) => {
                      setSelectedGroceryListId(e.target.value);
                      if (e.target.value) setNewGroceryListName('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">-- Select a list --</option>
                    {groceryLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="text-center text-sm text-gray-500">
                {groceryLists.length > 0 ? 'or' : ''}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Create new list:
                </label>
                <input
                  type="text"
                  name="newListName"
                  value={newGroceryListName}
                  onChange={(e) => {
                    setNewGroceryListName(e.target.value);
                    if (e.target.value) setSelectedGroceryListId('');
                  }}
                  placeholder="Enter list name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600 mb-2">
                  This will add all {recipe.ingredients.length} ingredients from this recipe.
                </p>
                <p className="text-xs text-gray-500">
                  Duplicate ingredients will be combined with existing quantities.
                </p>
              </div>
              
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowGroceryListModal(false);
                    setSelectedGroceryListId('');
                    setNewGroceryListName('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={!selectedGroceryListId && !newGroceryListName.trim()}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingCart size={16} className="mr-2" />
                  Add Ingredients
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}