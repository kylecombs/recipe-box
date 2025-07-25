import { json, LoaderFunctionArgs, ActionFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Form, useActionData, useNavigation } from "@remix-run/react";
import { Clock, Users, ExternalLink, Edit2, Save, X, Plus, Trash2, Upload, StickyNote, AlertTriangle, ShoppingCart, Star, Globe, Lock } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { db } from "~/utils/db.server";
import { requireUserId } from "~/utils/auth.server";
import { areIngredientsEqual, combineQuantities, getCanonicalIngredientName } from "~/utils/ingredient-matcher.server";
import IngredientsList from "~/components/IngredientsList";
import InstructionsList from "~/components/InstructionsList";
import TagsList from "~/components/TagsList";
import Toast from "~/components/Toast";
import GroceryListModal from "~/components/GroceryListModal";
import StarRating from "~/components/StarRating";
import RatingForm from "~/components/RatingForm";
import TimerManager, { type TimerManagerRef } from "~/components/TimerManager";
import { detectTimersFromRecipe, DetectedTimer } from "~/utils/time-parser";
import { getRecipeNutrition } from "~/utils/nutrition-storage.server";
import NutritionFacts from "~/components/NutritionFacts";
import type { RecipeNutrition } from "~/utils/nutrition.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const recipeId = params.recipeId;

  if (!recipeId) {
    throw new Response("Recipe not found", { status: 404 });
  }

  // Check if user has access to this recipe through UserRecipe association
  const userRecipe = await db.userRecipe.findFirst({
    where: {
      userId: userId,
      recipeId: recipeId,
    },
    include: {
      recipe: {
        include: {
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
      },
    },
  });

  const recipe = userRecipe?.recipe;

  if (!recipe) {
    throw new Response("Recipe not found", { status: 404 });
  }

  // Also fetch user's grocery lists
  const groceryLists = await db.groceryList.findMany({
    where: { userId },
    include: { items: true }
  });

  // Fetch notes separately
  const notes = await db.note.findMany({
    where: { recipeId },
    orderBy: { createdAt: 'desc' }
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

  // Check for cached nutrition data only (don't block page load with analysis)
  let nutrition = null;
  try {
    nutrition = await getRecipeNutrition(recipeId);
  } catch (error) {
    console.error('Failed to get cached nutrition:', error);
  }

  return json({ recipe, groceryLists, notes, userRating, ratingStats, nutrition });
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
          instructionSteps: true,
          tags: { include: { tag: true } },
        }
      });

      if (!existingRecipe) {
        throw new Response("Recipe not found", { status: 404 });
      }

      // Add new note using Prisma
      await db.note.create({
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
          instructionSteps: true,
          tags: { include: { tag: true } },
        }
      });

      if (!existingRecipe) {
        throw new Response("Recipe not found", { status: 404 });
      }

      // Remove the note using Prisma
      await db.note.delete({
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
          instructionSteps: true,
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
          instructionSteps: true,
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
            original: 'original' in ing ? ing.original as string : `${ing.quantity || ''} ${ing.unit || ''} ${ing.name}`.trim(),
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
  
  if (intent === "togglePublic") {
    try {
      const existingRecipe = await db.recipe.findFirst({
        where: { id: recipeId, userId },
      });

      if (!existingRecipe) {
        throw new Response("Recipe not found", { status: 404 });
      }

      const isPublic = formData.get("isPublic") === "true";
      
      await db.recipe.update({
        where: { id: recipeId },
        data: {
          isPublic,
          publishedAt: isPublic ? new Date() : null,
        },
      });

      return json({ 
        success: true, 
        toggledPublic: true,
        isPublic,
        message: isPublic ? "Recipe published to community!" : "Recipe made private"
      });
    } catch (error) {
      console.error("Error toggling recipe visibility:", error);
      return json({ error: "Failed to update recipe visibility" }, { status: 500 });
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

export default function RecipeDetail() {
  const { recipe, groceryLists, notes, userRating, ratingStats, nutrition: initialNutrition } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [isEditing, setIsEditing] = useState(false);
  const isSubmitting = navigation.state === "submitting";
  
  // Async nutrition loading state
  const [nutrition, setNutrition] = useState<RecipeNutrition | null>(initialNutrition);
  const [isLoadingNutrition, setIsLoadingNutrition] = useState(false);
  
  // Initialize ingredients and instructions state for editing
  const [editableIngredients, setEditableIngredients] = useState(recipe.ingredients);
  const [editableInstructions, setEditableInstructions] = useState(recipe.instructionSteps);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showGroceryListModal, setShowGroceryListModal] = useState(false);
  const [selectedGroceryListId, setSelectedGroceryListId] = useState<string>('');
  const [newGroceryListName, setNewGroceryListName] = useState('');
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  // Refs for timer functionality
  const timerManagerRef = useRef<TimerManagerRef>(null);

  // Detect timers from recipe content
  const detectedTimers = detectTimersFromRecipe(
    recipe.instructionSteps.map(step => step.description),
    recipe.cookTime || undefined,
    recipe.id
  );

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
        } else if ('toggledPublic' in actionData && actionData.toggledPublic) {
          const message = 'message' in actionData ? actionData.message : 'Recipe visibility updated!';
          setToast({ message: message as string, type: 'success' });
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
      setEditableInstructions(recipe.instructionSteps);
    } else {
      setImagePreview(null);
    }
  }, [isEditing, recipe.ingredients, recipe.instructionSteps]);
  
  // Function to load nutrition data when user requests it
  const loadNutritionData = async () => {
    if (recipe.ingredients.length === 0) {
      setToast({ message: 'Recipe must have ingredients to analyze nutrition', type: 'error' });
      return;
    }
    
    setIsLoadingNutrition(true);
    
    try {
      const response = await fetch('/api/nutrition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipeId: recipe.id }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.nutrition) {
          setNutrition({
            ...data.nutrition,
            lastAnalyzed: new Date(data.nutrition.lastAnalyzed)
          });
        }
      } else {
        console.warn('Failed to load nutrition data:', response.statusText);
        setToast({ message: 'Failed to analyze nutrition', type: 'error' });
      }
    } catch (error) {
      console.error('Error loading nutrition data:', error);
      setToast({ message: 'Error analyzing nutrition', type: 'error' });
    } finally {
      setIsLoadingNutrition(false);
    }
  };
  
  const addIngredient = () => {
    setEditableIngredients([...editableIngredients, {
      id: `temp-ing-${Date.now()}`,
      name: '',
      quantity: null,
      unit: null,
      notes: null,
      original: '',
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
          show={!!toast.message}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* Page Actions */}
      <div className="mb-6">
        <div className="flex justify-end mb-4">
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
              <>
                <Form method="post" className="inline">
                  <input type="hidden" name="intent" value="togglePublic" />
                  <input type="hidden" name="isPublic" value={(!recipe.isPublic).toString()} />
                  <button
                    type="submit"
                    className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border ${
                      recipe.isPublic
                        ? 'text-orange-700 bg-white border-orange-300 hover:bg-orange-50'
                        : 'text-green-700 bg-white border-green-300 hover:bg-green-50'
                    }`}
                  >
                    {recipe.isPublic ? (
                      <>
                        <Lock size={16} className="mr-2" />
                        Make Private
                      </>
                    ) : (
                      <>
                        <Globe size={16} className="mr-2" />
                        Publish to Community
                      </>
                    )}
                  </button>
                </Form>
                
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50"
                >
                  <Trash2 size={16} className="mr-2" />
                  Delete
                </button>
              </>
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
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-3xl font-bold text-gray-900">{recipe.title}</h1>
                {recipe.isPublic && (
                  <div className="flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                    <Globe size={12} className="mr-1" />
                    Public
                  </div>
                )}
              </div>
              
              {recipe.description && (
                <div className="mb-4">
                  <p className="text-gray-600 text-lg">
                    {(() => {
                      const lines = recipe.description.split('\n');
                      const isLong = lines.length > 8 || recipe.description.length > 800;
                      
                      if (isLong && !isDescriptionExpanded) {
                        // Find approximately where the 10th line would be
                        const truncatedLines = lines.slice(0, 8);
                        const truncatedText = truncatedLines.join('\n');
                        
                        // If the truncated text is still very long, further truncate by character count
                        const displayText = truncatedText.length > 500 
                          ? truncatedText.substring(0, 500).trim() + '...'
                          : truncatedText + (lines.length > 8 ? '...' : '');
                        
                        return displayText;
                      }
                      
                      return recipe.description;
                    })()}
                  </p>
                  {(() => {
                    const lines = recipe.description.split('\n');
                    const isLong = lines.length > 10 || recipe.description.length > 800;
                    
                    if (isLong) {
                      return (
                        <button
                          onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                          className="text-sm text-blue-600 hover:text-blue-800 mt-2"
                        >
                          {isDescriptionExpanded ? 'Read Less' : 'Read More'}
                        </button>
                      );
                    }
                    
                    return null;
                  })()}
                </div>
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
              
              {/* Rating Section */}
              <div className="mt-6 pt-6 border-t border-gray-200">
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
                          <p className="text-sm text-gray-600 italic">&quot;{userRating.comment}&quot;</p>
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
            </div>
          </div>
        )}
      </div>

      {/* Nutrition Facts */}
              {nutrition && (
                <div className="mb-4">
                  <NutritionFacts nutrition={{
                    ...nutrition,
                    lastAnalyzed: new Date(nutrition.lastAnalyzed)
                  }} />
                </div>
              )}
              {!nutrition && !isLoadingNutrition && recipe.ingredients.length > 0 && (
                <div className="mb-4">
                  <button
                    onClick={loadNutritionData}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Get Nutrition Info
                  </button>
                </div>
              )}
              {isLoadingNutrition && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-gray-600">Analyzing nutrition...</span>
                  </div>
                </div>
              )}

      {/* Timers - Only show when not editing */}
      {!isEditing && detectedTimers.length > 0 && (
        <TimerManager 
          ref={timerManagerRef}
          timers={detectedTimers} 
          recipeId={recipe.id}
          onContextClick={(timer) => {
            // Scroll to the timer context in the instructions
            const scrollFunction = (window as unknown as { scrollToTimerInInstructions?: (timer: DetectedTimer) => void }).scrollToTimerInInstructions;
            if (scrollFunction) {
              scrollFunction(timer);
            }
          }}
        />
      )}

      {/* Recipe Content - Only show when not editing */}
      {!isEditing && (
        <>
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Ingredients */}
            <div className="lg:col-span-1">
              <div className="mb-4 space-y-4">
                <IngredientsList ingredients={recipe.ingredients} originalServings={recipe.servings || undefined} />
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
              <InstructionsList 
                instructions={recipe.instructionSteps} 
                timers={detectedTimers}
                recipeTitle={recipe.title}
                recipeDescription={recipe.description || ""}
                onTimerClick={(timer) => {
                  // Scroll to the corresponding timer in TimerManager
                  if (timerManagerRef.current) {
                    timerManagerRef.current.scrollToTimer(timer);
                  }
                }}
              />
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
                {notes.map((note) => (
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
      <GroceryListModal
        isOpen={showGroceryListModal}
        onClose={() => {
          setShowGroceryListModal(false);
          setSelectedGroceryListId('');
          setNewGroceryListName('');
        }}
        groceryLists={groceryLists}
        selectedGroceryListId={selectedGroceryListId}
        setSelectedGroceryListId={setSelectedGroceryListId}
        newGroceryListName={newGroceryListName}
        setNewGroceryListName={setNewGroceryListName}
        itemCount={recipe.ingredients.length}
        itemDescription="ingredients"
        actionIntent="addToGroceryList"
      />
    </div>
  );
}