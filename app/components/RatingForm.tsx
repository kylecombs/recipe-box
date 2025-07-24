import { useState, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import StarRating from "./StarRating";
import { MessageSquare, Save, X } from "lucide-react";

interface RatingFormProps {
  itemId: string;
  itemType: 'recipe' | 'mealplan';
  currentRating?: number;
  currentComment?: string;
  onClose?: () => void;
  compact?: boolean;
}

export default function RatingForm({ 
  itemId, 
  itemType, 
  currentRating = 0, 
  currentComment = "",
  onClose,
  compact = false
}: RatingFormProps) {
  const fetcher = useFetcher();
  const [rating, setRating] = useState(currentRating);
  const [comment, setComment] = useState(currentComment);
  const [showCommentField, setShowCommentField] = useState(!!currentComment);
  const [hasChanged, setHasChanged] = useState(false);

  useEffect(() => {
    setHasChanged(
      rating !== currentRating || 
      comment.trim() !== currentComment.trim()
    );
  }, [rating, comment, currentRating, currentComment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rating === 0) return;

    const formData = new FormData();
    formData.append("intent", "rate");
    formData.append("rating", rating.toString());
    formData.append("comment", comment.trim());
    formData.append("itemType", itemType);
    formData.append("itemId", itemId);

    fetcher.submit(formData, { 
      method: "post",
      action: "/api/ratings" 
    });
  };

  const isLoading = fetcher.state === "submitting";

  // Handle successful submission
  useEffect(() => {
    const data = fetcher.data as { success?: boolean; error?: string };
    if (fetcher.state === "idle" && data.success && hasChanged) {
      setHasChanged(false);
      if (onClose) {
        onClose();
      }
    }
  }, [fetcher.state, fetcher.data, hasChanged, onClose]);

  if (compact && currentRating > 0 && !hasChanged) {
    return (
      <div className="flex items-center">
        <StarRating 
          rating={currentRating} 
          readonly 
          size={16}
          showRatingText
        />
        <button
          onClick={() => setHasChanged(true)}
          className="ml-2 text-xs text-blue-600 hover:text-blue-700"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className={`${compact ? 'bg-gray-50 p-3 rounded-lg' : 'bg-white p-4 border rounded-lg'}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-sm">
          {currentRating > 0 ? 'Update Rating' : 'Rate this ' + itemType}
        </h4>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <fetcher.Form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <div className="block text-sm font-medium text-gray-700 mb-2">
            Rating *
          </div>
          <StarRating
            rating={rating}
            onRatingChange={setRating}
            size={24}
            showRatingText
          />
        </div>

        <div>
          {!showCommentField ? (
            <button
              type="button"
              onClick={() => setShowCommentField(true)}
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
            >
              <MessageSquare size={14} className="mr-1" />
              Add comment (optional)
            </button>
          ) : (
            <div>
              <label htmlFor="ratingComment" className="block text-sm font-medium text-gray-700 mb-2">
                Comment (optional)  
              </label>
              <textarea
                id="ratingComment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Share your thoughts about this recipe or meal plan..."
              />
              <button
                type="button"
                onClick={() => {
                  setShowCommentField(false);
                  setComment("");
                }}
                className="mt-1 text-xs text-gray-500 hover:text-gray-700"
              >
                Remove comment
              </button>
            </div>
          )}
        </div>

        {(fetcher.data as { error?: string })?.error && (
          <div className="text-red-600 text-sm">
            {(fetcher.data as { error?: string }).error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={rating === 0 || isLoading || !hasChanged}
            className="inline-flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Save size={14} className="mr-1" />
            {isLoading ? 'Saving...' : currentRating > 0 ? 'Update' : 'Submit'}
          </button>
        </div>
      </fetcher.Form>
    </div>
  );
}