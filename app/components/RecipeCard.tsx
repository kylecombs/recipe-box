import StarRating from "./StarRating";
import { Leaf, Wheat, Droplets, Clock, Zap, Heart } from "lucide-react";
import Tooltip from "./Tooltip";

interface RecipeCardProps {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  hasUpdates?: boolean;
  userRating?: { rating: number; comment?: string } | null;
  tags?: Array<{ tag: { name: string } }>;
}

// Map dietary tags to icons and colors
const getDietaryIcon = (tagName: string) => {
  const tag = tagName.toLowerCase();
  
  if (tag === 'vegetarian') return { icon: Leaf, color: 'text-green-600', title: 'Vegetarian' };
  if (tag === 'vegan') return { icon: Leaf, color: 'text-green-700', title: 'Vegan' };
  if (tag === 'gluten-free' || tag === 'gluten free') return { icon: Wheat, color: 'text-amber-600', title: 'Gluten-Free' };
  if (tag === 'dairy-free' || tag === 'dairy free') return { icon: Droplets, color: 'text-blue-600', title: 'Dairy-Free' };
  if (tag === 'quick') return { icon: Clock, color: 'text-purple-600', title: 'Quick Recipe' };
  if (tag === 'healthy') return { icon: Heart, color: 'text-red-500', title: 'Healthy' };
  if (tag === 'low-carb' || tag === 'low carb' || tag === 'keto') return { icon: Zap, color: 'text-orange-600', title: 'Low-Carb' };
  
  return null;
};

export default function RecipeCard({ 
  id, 
  title, 
  description, 
  imageUrl, 
  prepTime, 
  cookTime, 
  servings,
  hasUpdates,
  userRating,
  tags
}: RecipeCardProps) {
  return (
    <a href={`/recipes/${id}`} className="block border rounded-lg p-4 hover:shadow-lg transition-shadow relative">
      {hasUpdates && (
        <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
          Update Available
        </div>
      )}
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
      <div className="space-y-2">
        <div className="flex gap-4 text-sm text-gray-500">
          {prepTime && <span>Prep: {prepTime}m</span>}
          {cookTime && <span>Cook: {cookTime}m</span>}
          {servings && <span>Serves: {servings}</span>}
        </div>
        {userRating && (
          <div className="flex items-center">
            <StarRating rating={userRating.rating} readonly size={14} />
            <span className="ml-2 text-xs text-gray-500">Your rating</span>
          </div>
        )}
      </div>
      
      {/* Dietary restriction icons in lower right corner */}
      {tags && tags.length > 0 && (
        <div className="absolute bottom-3 right-3 flex gap-1">
          {tags
            .map(({ tag }) => getDietaryIcon(tag.name))
            .filter((iconData) => iconData !== null)
            .slice(0, 4) // Limit to 4 icons to avoid overcrowding
            .map((iconData, index) => {
              const Icon = iconData!.icon;
              return (
                <Tooltip key={index} content={iconData!.title}>
                  <div
                    className={`${iconData!.color} bg-white bg-opacity-90 rounded-full p-1 shadow-sm hover:scale-110 transition-transform cursor-pointer`}
                  >
                    <Icon size={12} />
                  </div>
                </Tooltip>
              );
            })}
        </div>
      )}
    </a>
  );
} 