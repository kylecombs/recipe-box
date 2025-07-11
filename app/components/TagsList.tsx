interface TagsListProps {
  tags: string[];
}

export default function TagsList({ tags }: TagsListProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, index) => (
        <span key={index} className="bg-gray-200 rounded-full px-3 py-1 text-sm">
          {tag}
        </span>
      ))}
    </div>
  );
} 