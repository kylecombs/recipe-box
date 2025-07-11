interface Ingredient {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  notes: string | null;
}

interface IngredientsListProps {
  ingredients: Ingredient[];
}

export default function IngredientsList({ ingredients }: IngredientsListProps) {
  return (
    <div>
      <h4 className="font-semibold mb-3 text-lg">Ingredients</h4>
      <ul className="space-y-2">
        {ingredients.map((ingredient) => (
          <li key={ingredient.id} className="flex items-start">
            <span className="text-blue-600 mr-2">•</span>
            <div>
              <span className="font-medium">
                {ingredient.quantity && `${ingredient.quantity} `}
                {ingredient.unit && `${ingredient.unit} `}
                {ingredient.name}
              </span>
              {ingredient.notes && (
                <span className="text-gray-600 text-sm ml-1">({ingredient.notes})</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
} 