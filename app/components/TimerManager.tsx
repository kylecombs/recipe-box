import { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from "react";
import { Clock, ChevronDown, ChevronUp } from "lucide-react";
import Timer from "./Timer";
import type { DetectedTimer, TimerState } from "~/utils/time-parser";

interface TimerManagerProps {
  timers: DetectedTimer[];
  recipeId: string;
  onContextClick?: (timer: DetectedTimer) => void;
}

export interface TimerManagerRef {
  scrollToTimer: (timer: DetectedTimer) => void;
}

const TimerManager = forwardRef<TimerManagerRef, TimerManagerProps>(({ timers, recipeId, onContextClick }, ref) => {
  const [timerStates, setTimerStates] = useState<Record<string, TimerState>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasActiveTimers, setHasActiveTimers] = useState(false);
  const timerManagerRef = useRef<HTMLDivElement>(null);
  const timerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Timer persistence is now handled by localStorage in individual Timer components

  // Function to scroll to a specific timer
  const scrollToTimer = useCallback((timer: DetectedTimer) => {
    // First expand the timer manager if it's collapsed
    if (!isExpanded) {
      setIsExpanded(true);
    }
    
    // Wait for expansion animation to complete, then scroll
    setTimeout(() => {
      const timerElement = timerRefs.current.get(timer.id);
      if (timerElement) {
        timerElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        
        // Add a prominent highlight effect to the timer
        // First, create a highlight overlay
        const highlight = document.createElement('div');
        highlight.style.position = 'absolute';
        highlight.style.inset = '0';
        highlight.style.backgroundColor = '#ffde87';
        highlight.style.borderRadius = '0.5rem';
        highlight.style.opacity = '0';
        highlight.style.pointerEvents = 'none';
        highlight.style.transition = 'opacity 0.3s ease-in-out';
        
        // Position the timer element relatively if not already
        const originalPosition = timerElement.style.position;
        if (!originalPosition || originalPosition === 'static') {
          timerElement.style.position = 'relative';
        }
        
        // Add the highlight
        timerElement.appendChild(highlight);
        
        // Animate the highlight
        requestAnimationFrame(() => {
          highlight.style.opacity = '0.4';
          
          // Also add a scale effect to the timer itself
          timerElement.style.transition = 'transform 0.3s ease';
          timerElement.style.transform = 'scale(1.05)';
          
          // Start fading out after a brief pause
          setTimeout(() => {
            highlight.style.opacity = '0';
            timerElement.style.transform = '';
            
            // Clean up after animation completes
            setTimeout(() => {
              highlight.remove();
              if (!originalPosition || originalPosition === 'static') {
                timerElement.style.position = '';
              }
              timerElement.style.transition = '';
            }, 300);
          }, 600);
        });
      } else if (timerManagerRef.current) {
        // Fallback: scroll to timer manager
        timerManagerRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, isExpanded ? 0 : 300); // Wait for expansion if needed
  }, [isExpanded]);

  // Expose scrollToTimer to parent components
  useImperativeHandle(ref, () => ({
    scrollToTimer
  }));

  // Check for active timers in localStorage on mount and expand if found
  useEffect(() => {
    // Check if any timers are currently running in localStorage
    const checkForActiveTimers = () => {
      if (typeof window === 'undefined') return false;
      
      let hasRunningTimers = false;
      
      // Check each timer's localStorage to see if it's running
      timers.forEach(timer => {
        const storageKey = `timer_${timer.id}`;
        const savedEndDate = localStorage.getItem(storageKey);
        
        if (savedEndDate && !isNaN(parseInt(savedEndDate, 10))) {
          const currentTime = Date.now();
          const endTime = parseInt(savedEndDate, 10);
          const delta = endTime - currentTime;
          
          // If timer has time remaining, it's still running
          if (delta > 0) {
            hasRunningTimers = true;
          }
        }
      });
      
      return hasRunningTimers;
    };
    
    // Expand timer manager if there are active timers on page load
    if (checkForActiveTimers()) {
      setIsExpanded(true);
    }
  }, [recipeId, timers]);

  // Handle timer state changes (just for UI updates)
  // Use useCallback with empty deps to prevent infinite loops
  const handleTimerStateChange = useCallback((state: TimerState) => {
    setTimerStates(prev => {
      // Only update if the state actually changed to prevent unnecessary re-renders
      const currentState = prev[state.id];
      if (currentState && 
          currentState.isRunning === state.isRunning && 
          currentState.remainingTime === state.remainingTime &&
          currentState.isPaused === state.isPaused) {
        return prev; // No change, return same object to prevent re-render
      }
      
      return {
        ...prev,
        [state.id]: state
      };
    });
  }, []); // Empty deps to prevent recreation

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
    <div ref={timerManagerRef} className="bg-white rounded-lg shadow-md border mb-8">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {timers.map(timer => (
              <div
                key={timer.id}
                ref={(el) => {
                  if (el) {
                    timerRefs.current.set(timer.id, el);
                  } else {
                    timerRefs.current.delete(timer.id);
                  }
                }}
              >
                <Timer
                  timer={timer}
                  initialState={timerStates[timer.id]}
                  onStateChange={handleTimerStateChange}
                  onContextClick={onContextClick}
                />
              </div>
            ))}
          </div>
          
          {/* Helper text */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            <p className="font-medium mb-1">💡 Timer Tips:</p>
            <ul className="text-xs space-y-1">
              <li>• Timers persist across page reloads using localStorage</li>
              <li>• Browser notifications will alert you when timers complete</li>
              <li>• Multiple timers can run simultaneously</li>
              <li>• Pause/resume automatically adjusts end timestamps</li>
              <li>• Completed timers are automatically cleaned up</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
});

TimerManager.displayName = 'TimerManager';

export default TimerManager;