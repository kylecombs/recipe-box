interface RecipeCardProps {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
}

export default function RecipeCard({ 
  id, 
  title, 
  description, 
  imageUrl, 
  prepTime, 
  cookTime, 
  servings 
}: RecipeCardProps) {
  return (
    <a href={`/recipes/${id}`} className="block border rounded-lg p-4 hover:shadow-lg transition-shadow">
      {imageUrl && (
        <img 
          src={imageUrl} 
          alt={title} 
          className="w-full h-48 object-cover rounded-lg mb-3"
        />
      )}
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      {description && (
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{description}</p>
      )}
      <div className="flex gap-4 text-sm text-gray-500">
        {prepTime && <span>Prep: {prepTime}m</span>}
        {cookTime && <span>Cook: {cookTime}m</span>}
        {servings && <span>Serves: {servings}</span>}
      </div>
    </a>
  );
} 