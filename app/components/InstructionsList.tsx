import { useRef, createRef, useEffect } from "react";
import HighlightableText, { type HighlightableTextRef } from "./HighlightableText";
import type { DetectedTimer } from "~/utils/time-parser";

interface Instruction {
  id: string;
  stepNumber: number;
  description: string;
}

interface InstructionsListProps {
  instructions: Instruction[];
  timers?: DetectedTimer[];
  recipeTitle?: string;
  recipeDescription?: string;
}

export default function InstructionsList({ 
  instructions, 
  timers = [], 
  recipeTitle = "", 
  recipeDescription = "" 
}: InstructionsListProps) {
  const highlightRefs = useRef<Map<string, HighlightableTextRef>>(new Map());
  
  // Calculate the cumulative text offset to map timer positions to instructions
  // This must match exactly how text is joined in detectTimersFromRecipe
  const getCumulativeTextOffset = (stepIndex: number) => {
    const sortedInstructions = instructions.sort((a, b) => a.stepNumber - b.stepNumber);
    
    // Start with title and description (joined with spaces)
    let offset = 0;
    if (recipeTitle) offset += recipeTitle.length + 1; // +1 for space separator
    if (recipeDescription) offset += recipeDescription.length + 1; // +1 for space separator
    
    // Add lengths of previous instructions
    for (let i = 0; i < stepIndex; i++) {
      offset += sortedInstructions[i].description.length + 1; // +1 for the space separator
    }
    
    return offset;
  };

  // Create a global function to handle timer scrolling
  useEffect(() => {
    (window as any).scrollToTimerInInstructions = (timer: DetectedTimer) => {
      // Find which instruction contains this timer
      const sortedInstructions = instructions.sort((a, b) => a.stepNumber - b.stepNumber);
      
      for (let i = 0; i < sortedInstructions.length; i++) {
        const instructionStart = getCumulativeTextOffset(i);
        const instructionEnd = instructionStart + sortedInstructions[i].description.length;
        
        if (timer.contextStart >= instructionStart && timer.contextEnd <= instructionEnd) {
          const ref = highlightRefs.current.get(sortedInstructions[i].id);
          if (ref) {
            // Adjust timer positions to be relative to this instruction
            const adjustedTimer = {
              ...timer,
              contextStart: timer.contextStart - instructionStart,
              contextEnd: timer.contextEnd - instructionStart,
            };
            ref.scrollToTimer(adjustedTimer);
            return;
          }
        }
      }
    };
    
    return () => {
      delete (window as any).scrollToTimerInInstructions;
    };
  }, [instructions, timers, recipeTitle, recipeDescription]);

  // Filter timers for each instruction based on position
  const getTimersForInstruction = (instruction: Instruction, stepIndex: number) => {
    const instructionStart = getCumulativeTextOffset(stepIndex);
    const instructionEnd = instructionStart + instruction.description.length;
    
    return timers.filter(timer => {
      // Timer positions are in the full text, so we need to check if they fall within this instruction
      return timer.contextStart >= instructionStart && timer.contextEnd <= instructionEnd;
    }).map(timer => ({
      ...timer,
      // Adjust positions to be relative to this instruction
      contextStart: timer.contextStart - instructionStart,
      contextEnd: timer.contextEnd - instructionStart,
    }));
  };

  const sortedInstructions = instructions.sort((a, b) => a.stepNumber - b.stepNumber);

  return (
    <div>
      <h4 className="font-semibold mb-3 text-lg">Instructions</h4>
      <ol className="space-y-4">
        {sortedInstructions.map((instruction, index) => {
          const instructionTimers = getTimersForInstruction(instruction, index);
          
          return (
            <li key={instruction.id} className="flex items-start">
              <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                {instruction.stepNumber}
              </span>
              <div className="leading-relaxed flex-1">
                <HighlightableText
                  ref={(ref) => {
                    if (ref) {
                      highlightRefs.current.set(instruction.id, ref);
                    } else {
                      highlightRefs.current.delete(instruction.id);
                    }
                  }}
                  text={instruction.description}
                  timers={instructionTimers}
                  className="leading-relaxed"
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
} 