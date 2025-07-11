interface GroceryListItemProps {
  item: string; // Or a more complex type { name: string, quantity: number, unit: string }
  isChecked: boolean;
  onToggle: () => void;
}

export default function GroceryListItem(
  { item, isChecked, onToggle }: GroceryListItemProps
) {
  return (
    <li className="flex items-center mb-1">
      <input
        type="checkbox"
        checked={isChecked}
        onChange={onToggle}
        className="mr-2"
      />
      <span className={`${isChecked ? 'line-through text-gray-500' : ''}`}>
        {item}
      </span>
    </li>
  );
} 