interface Instruction {
  id: string;
  stepNumber: number;
  description: string;
}

interface InstructionsListProps {
  instructions: Instruction[];
}

export default function InstructionsList({ instructions }: InstructionsListProps) {
  return (
    <div>
      <h4 className="font-semibold mb-3 text-lg">Instructions</h4>
      <ol className="space-y-4">
        {instructions
          .sort((a, b) => a.stepNumber - b.stepNumber)
          .map((instruction) => (
            <li key={instruction.id} className="flex items-start">
              <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                {instruction.stepNumber}
              </span>
              <p className="leading-relaxed">{instruction.description}</p>
            </li>
          ))}
      </ol>
    </div>
  );
} 