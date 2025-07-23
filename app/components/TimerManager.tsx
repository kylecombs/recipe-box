import { useState, useEffect, useCallback } from "react";
import { Clock, ChevronDown, ChevronUp } from "lucide-react";
import Timer from "./Timer";
import type { DetectedTimer, TimerState } from "~/utils/time-parser";

interface TimerManagerProps {
  timers: DetectedTimer[];
  recipeId: string;
}

export default function TimerManager({ timers, recipeId }: TimerManagerProps) {
  const [timerStates, setTimerStates] = useState<Record<string, TimerState>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasActiveTimers, setHasActiveTimers] = useState(false);

  // Storage key for persistence
  const storageKey = `recipe-timers-${recipeId}`;

  // Load timer states from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const savedStates = JSON.parse(saved) as Record<string, TimerState>;
          
          // Validate and restore timer states
          const currentTime = Date.now();
          const restoredStates: Record<string, TimerState> = {};
          
          timers.forEach(timer => {
            const savedState = savedStates[timer.id];
            if (savedState) {
              let remainingTime = savedState.remainingTime;
              
              // If timer was running, calculate elapsed time
              if (savedState.isRunning && savedState.startTime) {
                const elapsed = Math.floor((currentTime - savedState.startTime) / 1000);
                remainingTime = Math.max(0, savedState.totalDuration - elapsed);
                
                // If timer expired while away, mark as completed
                if (remainingTime === 0) {
                  restoredStates[timer.id] = {
                    ...savedState,
                    isRunning: false,
                    remainingTime: 0,
                  };
                } else {
                  restoredStates[timer.id] = {
                    ...savedState,
                    remainingTime,
                  };
                }
              } else if (savedState.pausedTime) {
                // Timer was paused, keep the paused state
                restoredStates[timer.id] = savedState;
              } else {
                // Timer was stopped
                restoredStates[timer.id] = savedState;
              }
            }
          });
          
          setTimerStates(restoredStates);
        }
      } catch (error) {
        console.error('Failed to load timer states:', error);
      }
    }
  }, [recipeId, storageKey, timers]);

  // Save timer states to localStorage
  const saveTimerStates = useCallback((states: Record<string, TimerState>) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(states));
      } catch (error) {
        console.error('Failed to save timer states:', error);
      }
    }
  }, [storageKey]);

  // Handle timer state changes
  const handleTimerStateChange = useCallback((state: TimerState) => {
    setTimerStates(prev => {
      const newStates = { ...prev, [state.id]: state };
      saveTimerStates(newStates);
      return newStates;
    });
  }, [saveTimerStates]);

  // Check for active timers
  useEffect(() => {
    const activeCount = Object.values(timerStates).filter(state => state.isRunning).length;
    setHasActiveTimers(activeCount > 0);
  }, [timerStates]);

  // Auto-expand when timers are active
  useEffect(() => {
    if (hasActiveTimers && !isExpanded) {
      setIsExpanded(true);
    }
  }, [hasActiveTimers, isExpanded]);

  if (timers.length === 0) {
    return null;
  }

  const activeTimerCount = Object.values(timerStates).filter(state => state.isRunning).length;
  const completedTimerCount = Object.values(timerStates).filter(
    state => state.remainingTime === 0
  ).length;

  return (
    <div className="bg-white rounded-lg shadow-md border mb-8">
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        role="button"
        tabIndex={0}
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center">
          <Clock size={24} className="mr-3 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Recipe Timers ({timers.length})
            </h3>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {activeTimerCount > 0 && (
                <span className="text-green-600 font-medium">
                  {activeTimerCount} running
                </span>
              )}
              {completedTimerCount > 0 && (
                <span className="text-red-600 font-medium">
                  {completedTimerCount} completed
                </span>
              )}
              {activeTimerCount === 0 && completedTimerCount === 0 && (
                <span>Click to view timers</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {hasActiveTimers && (
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" />
              <span className="text-sm text-green-600 font-medium">Active</span>
            </div>
          )}
          {isExpanded ? (
            <ChevronUp size={20} className="text-gray-400" />
          ) : (
            <ChevronDown size={20} className="text-gray-400" />
          )}
        </div>
      </div>

      {/* Timer Grid */}
      {isExpanded && (
        <div className="p-4 pt-0 border-t border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {timers.map(timer => (
              <Timer
                key={timer.id}
                timer={timer}
                initialState={timerStates[timer.id]}
                onStateChange={handleTimerStateChange}
              />
            ))}
          </div>
          
          {/* Helper text */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            <p className="font-medium mb-1">💡 Timer Tips:</p>
            <ul className="text-xs space-y-1">
              <li>• Timers will persist even if you reload the page</li>
              <li>• Browser notifications will alert you when timers complete</li>
              <li>• Multiple timers can run simultaneously</li>
              <li>• Use pause/resume to manage your cooking workflow</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}