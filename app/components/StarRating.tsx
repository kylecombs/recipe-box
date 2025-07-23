import { Star } from "lucide-react";
import { useState } from "react";

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  readonly?: boolean;
  size?: number;
  className?: string;
  showRatingText?: boolean;
}

export default function StarRating({ 
  rating, 
  onRatingChange, 
  readonly = false, 
  size = 20, 
  className = "",
  showRatingText = false 
}: StarRatingProps) {
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const handleStarClick = (starRating: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(starRating);
    }
  };

  const handleStarHover = (starRating: number) => {
    if (!readonly) {
      setHoveredRating(starRating);
      setIsHovering(true);
    }
  };

  const handleMouseLeave = () => {
    if (!readonly) {
      setIsHovering(false);
      setHoveredRating(0);
    }
  };

  const displayRating = isHovering ? hoveredRating : rating;
  
  return (
    <div className={`flex items-center ${className}`}>
      <div 
        className="flex items-center"
        onMouseLeave={handleMouseLeave}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`${
              readonly 
                ? 'cursor-default' 
                : 'cursor-pointer hover:scale-110 transition-transform'
            } p-0.5`}
            onClick={() => handleStarClick(star)}
            onMouseEnter={() => handleStarHover(star)}
            disabled={readonly}
          >
            <Star
              size={size}
              className={`${
                star <= displayRating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-gray-200 text-gray-300'
              } ${
                !readonly && isHovering && star <= hoveredRating
                  ? 'fill-yellow-300 text-yellow-300'
                  : ''
              }`}
            />
          </button>
        ))}
      </div>
      {showRatingText && (
        <span className="ml-2 text-sm text-gray-600">
          {rating > 0 ? `${rating}/5` : 'No rating'}
        </span>
      )}
    </div>
  );
}