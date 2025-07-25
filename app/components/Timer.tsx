import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Clock, AlertCircle, Edit3, Save, X } from "lucide-react";
import type { DetectedTimer, TimerState } from "~/utils/time-parser";

interface TimerProps {
  timer: DetectedTimer;
  onStateChange?: (state: TimerState) => void;
  initialState?: TimerState;
  onContextClick?: (timer: DetectedTimer) => void;
}

// Format time helper function
const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export default function Timer({ timer, onStateChange, initialState, onContextClick }: TimerProps) {
  // Helper function to get value from localStorage
  const getLocalStorageValue = (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  };

  // Custom timer duration from localStorage (overrides original timer.minutes)
  const getCustomDuration = () => {
    const customKey = `timer_custom_${timer.id}`;
    const saved = getLocalStorageValue(customKey);
    return saved ? parseInt(saved, 10) : timer.minutes;
  };

  const [customMinutes, setCustomMinutes] = useState(getCustomDuration());
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  
  const totalDurationMs = customMinutes * 60 * 1000; // Convert to milliseconds
  const storageKey = `timer_${timer.id}`;
  const pausedStorageKey = `${storageKey}_paused`;
  const customStorageKey = `timer_custom_${timer.id}`;
  
  // State for timer control (minimal, only for UI updates)
  const [timerState, setTimerState] = useState({
    isRunning: false,
    isPaused: false,
    isCompleted: false,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Refs for direct DOM manipulation
  const timeDisplayRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // RAF and timer data refs
  const rafRef = useRef<number | null>(null);
  const timerDataRef = useRef({
    remainingTime: Math.floor(totalDurationMs / 1000),
    endTime: 0,
    lastUpdateTime: 0,
  });

  // Helper function to set value in localStorage
  const setLocalStorageValue = (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
  };

  // Helper function to remove value from localStorage
  const removeLocalStorageValue = (key: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  };

  // Direct DOM updates using refs (no React re-renders)
  const updateTimerDisplay = useCallback((remainingSeconds: number, isRunning: boolean, isPaused: boolean, isCompleted: boolean) => {
    // Update time display
    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = formatTime(remainingSeconds);
      
      // Update color classes
      timeDisplayRef.current.className = `text-2xl font-mono font-bold text-center mb-4 ${
        isCompleted ? 'text-red-600' : 
        isRunning ? 'text-green-600' : 
        isPaused ? 'text-orange-600' : 'text-gray-600'
      }`;
    }

    // Update progress bar
    if (progressBarRef.current) {
      const totalSeconds = Math.floor(totalDurationMs / 1000);
      const progressPercentage = ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
      
      progressBarRef.current.style.width = `${progressPercentage}%`;
      progressBarRef.current.className = `h-2 rounded-full transition-all duration-300 ${
        isCompleted ? 'bg-red-500' :
        isRunning ? 'bg-green-500' :
        isPaused ? 'bg-orange-500' : 'bg-gray-400'
      }`;
    }

    // Update container background
    if (containerRef.current) {
      containerRef.current.className = `rounded-lg border p-4 transition-colors h-full ${
        isCompleted ? 'bg-red-50 border-red-200' :
        isRunning ? 'bg-green-50 border-green-200' :
        isPaused ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
      }`;
    }
  }, [totalDurationMs]);

  // RAF animation loop
  const animate = useCallback(() => {
    if (!timerState.isRunning) return;

    const now = Date.now();
    const endTime = timerDataRef.current.endTime;
    const remainingMs = Math.max(0, endTime - now);
    const remainingSeconds = Math.floor(remainingMs / 1000);

    timerDataRef.current.remainingTime = remainingSeconds;

    // Update DOM directly
    updateTimerDisplay(remainingSeconds, true, false, remainingSeconds === 0);

    if (remainingSeconds === 0) {
      // Timer completed
      setTimerState(prev => ({ ...prev, isRunning: false, isCompleted: true }));
      removeLocalStorageValue(storageKey);
      
      // Play notification sound
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.log('Audio play failed:', e));
      }
      
      // Browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`Timer Complete: ${timer.label}`, {
          body: `Your ${timer.type} timer has finished!`,
          icon: '/favicon.ico',
        });
      }

      // Notify parent component
      if (onStateChange) {
        onStateChange({
          id: timer.id,
          isRunning: false,
          remainingTime: 0,
          startTime: Date.now(),
          totalDuration: Math.floor(totalDurationMs / 1000),
          isPaused: false,
        });
      }
    } else {
      // Continue animation
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [timerState.isRunning, storageKey, timer.id, timer.label, timer.type, totalDurationMs, updateTimerDisplay, onStateChange]);

  // Start RAF loop
  const startAnimation = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(animate);
  }, [animate]);

  // Stop RAF loop
  const stopAnimation = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Initialize timer state from localStorage on mount
  useEffect(() => {
    const savedEndDate = getLocalStorageValue(storageKey);
    const pausedData = getLocalStorageValue(pausedStorageKey);
    
    if (pausedData) {
      // Timer was paused
      try {
        const pausedInfo = JSON.parse(pausedData);
        const remaining = Math.floor(pausedInfo.remainingTime / 1000);
        timerDataRef.current.remainingTime = remaining;
        setTimerState({
          isRunning: false,
          isPaused: true,
          isCompleted: false,
        });
        updateTimerDisplay(remaining, false, true, false);
      } catch (e) {
        console.error('Failed to parse paused timer data:', e);
        removeLocalStorageValue(pausedStorageKey);
      }
    } else if (savedEndDate && !isNaN(parseInt(savedEndDate, 10))) {
      // Timer was running
      const currentTime = Date.now();
      const endTime = parseInt(savedEndDate, 10);
      const delta = endTime - currentTime;

      if (delta > totalDurationMs) {
        // Invalid end date (somehow longer than total duration), clear it
        removeLocalStorageValue(storageKey);
      } else if (delta <= 0) {
        // Timer has expired while we were away
        timerDataRef.current.remainingTime = 0;
        setTimerState({
          isRunning: false,
          isPaused: false,
          isCompleted: true,
        });
        removeLocalStorageValue(storageKey);
        updateTimerDisplay(0, false, false, true);
      } else {
        // Timer is still running - restore the running state
        const remaining = Math.floor(delta / 1000);
        timerDataRef.current.remainingTime = remaining;
        timerDataRef.current.endTime = endTime;
        setTimerState({
          isRunning: true,
          isPaused: false,
          isCompleted: false,
        });
        updateTimerDisplay(remaining, true, false, false);
      }
    } else if (initialState) {
      // Use initial state if provided and no saved state
      timerDataRef.current.remainingTime = initialState.remainingTime;
      setTimerState({
        isRunning: initialState.isRunning,
        isPaused: initialState.isPaused || false,
        isCompleted: initialState.remainingTime === 0,
      });
      updateTimerDisplay(initialState.remainingTime, initialState.isRunning, initialState.isPaused || false, initialState.remainingTime === 0);
    } else {
      // Default initialization
      updateTimerDisplay(timerDataRef.current.remainingTime, false, false, false);
    }
    
    setIsInitialized(true);
  }, [initialState, pausedStorageKey, storageKey, totalDurationMs, updateTimerDisplay]);

  // RAF control effect - start/stop animation based on timer state
  useEffect(() => {
    if (!isInitialized) return;

    if (timerState.isRunning) {
      startAnimation();
    } else {
      stopAnimation();
    }

    return () => {
      stopAnimation();
    };
  }, [isInitialized, timerState.isRunning, startAnimation, stopAnimation]);

  const handleReset = useCallback(() => {
    // Clear all localStorage for this timer
    removeLocalStorageValue(storageKey);
    removeLocalStorageValue(pausedStorageKey);

    const resetTime = Math.floor(totalDurationMs / 1000);
    timerDataRef.current.remainingTime = resetTime;
    timerDataRef.current.endTime = 0;
    
    setTimerState({
      isRunning: false,
      isPaused: false,
      isCompleted: false,
    });
    
    updateTimerDisplay(resetTime, false, false, false);
  }, [storageKey, pausedStorageKey, totalDurationMs, updateTimerDisplay]);

  // Update parent component when state changes (throttled to reduce updates)
  const lastNotifiedStateRef = useRef<{isRunning: boolean, isPaused: boolean, isCompleted: boolean}>({
    isRunning: false,
    isPaused: false,
    isCompleted: false,
  });

  useEffect(() => {
    if (onStateChange && isInitialized) {
      // Only notify parent if significant state changes occurred
      const lastState = lastNotifiedStateRef.current;
      if (lastState.isRunning !== timerState.isRunning || 
          lastState.isPaused !== timerState.isPaused || 
          lastState.isCompleted !== timerState.isCompleted) {
        
        onStateChange({
          id: timer.id,
          isRunning: timerState.isRunning,
          remainingTime: timerDataRef.current.remainingTime,
          startTime: Date.now(),
          totalDuration: Math.floor(totalDurationMs / 1000),
          isPaused: timerState.isPaused,
        });

        lastNotifiedStateRef.current = {
          isRunning: timerState.isRunning,
          isPaused: timerState.isPaused,
          isCompleted: timerState.isCompleted,
        };
      }
    }
  }, [timerState, timer.id, totalDurationMs, onStateChange, isInitialized]);

  const handleStart = useCallback(() => {
    if (timerDataRef.current.remainingTime === 0) {
      // Reset timer if it's at 0
      handleReset();
      return;
    }

    const now = Date.now();
    const endTime = now + (timerDataRef.current.remainingTime * 1000);
    
    // Save end time to localStorage
    setLocalStorageValue(storageKey, endTime.toString());
    
    // Clear any paused state
    removeLocalStorageValue(pausedStorageKey);

    timerDataRef.current.endTime = endTime;
    setTimerState({
      isRunning: true,
      isPaused: false,
      isCompleted: false,
    });

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [storageKey, pausedStorageKey, handleReset]);

  const handlePause = useCallback(() => {
    // Save paused state with remaining time
    const pausedInfo = {
      remainingTime: timerDataRef.current.remainingTime * 1000,
      pausedAt: Date.now(),
    };
    setLocalStorageValue(pausedStorageKey, JSON.stringify(pausedInfo));
    
    // Remove running timer end date
    removeLocalStorageValue(storageKey);

    setTimerState(prev => ({
      ...prev,
      isRunning: false,
      isPaused: true,
    }));
    
    updateTimerDisplay(timerDataRef.current.remainingTime, false, true, false);
  }, [storageKey, pausedStorageKey, updateTimerDisplay]);

  // Edit timer duration functionality
  const handleEditStart = useCallback(() => {
    setEditValue(customMinutes.toString());
    setIsEditing(true);
  }, [customMinutes]);

  const handleEditSave = useCallback(() => {
    const newMinutes = parseInt(editValue, 10);
    if (newMinutes > 0 && newMinutes <= 1440) { // Max 24 hours
      setCustomMinutes(newMinutes);
      setLocalStorageValue(customStorageKey, newMinutes.toString());
      
      // Reset timer with new duration
      const newDurationMs = newMinutes * 60 * 1000;
      const resetTime = Math.floor(newDurationMs / 1000);
      timerDataRef.current.remainingTime = resetTime;
      timerDataRef.current.endTime = 0;
      
      // Clear any running/paused state
      removeLocalStorageValue(storageKey);
      removeLocalStorageValue(pausedStorageKey);
      
      setTimerState({
        isRunning: false,
        isPaused: false,
        isCompleted: false,
      });
      
      updateTimerDisplay(resetTime, false, false, false);
    }
    setIsEditing(false);
  }, [editValue, customStorageKey, storageKey, pausedStorageKey, updateTimerDisplay]);

  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
    setEditValue('');
  }, []);

  const getTypeIcon = () => {
    const iconProps = { size: 16, className: "mr-2" };
    
    // All timer types use the Clock icon for now
    // Could be enhanced later with specific icons for different cooking methods
    return <Clock {...iconProps} />;
  };

  // Create custom label with updated duration
  const getCustomLabel = () => {
    const baseLabel = timer.label.split('(')[0].trim(); // Get just the action part
    
    // Format time display
    let timeStr: string;
    if (timer.minMinutes !== undefined && timer.maxMinutes !== undefined && timer.minMinutes !== timer.maxMinutes) {
      // Show original range
      const formatTime = (mins: number) => {
        return mins >= 60 
          ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`
          : `${mins}m`;
      };
      timeStr = `${formatTime(timer.minMinutes)}-${formatTime(timer.maxMinutes)}`;
    } else {
      // Show current custom duration
      timeStr = customMinutes >= 60 
        ? `${Math.floor(customMinutes / 60)}h ${customMinutes % 60 > 0 ? `${customMinutes % 60}m` : ''}`.trim()
        : `${customMinutes}m`;
    }
    
    return `${baseLabel} (${timeStr})`;
  };

  return (
    <div ref={containerRef} className="rounded-lg border p-4 transition-colors h-full bg-gray-50 border-gray-200">
      {/* Hidden audio element for notification */}
      <audio
        ref={audioRef}
        preload="auto"
        src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66dVFApGn+DyvmAcBDmU2fPNeSsFJXfH8N2QQAoUXrTp66dVFApGn+DyvmAcBDmU2fPNeSsFJXfH8N2QQAoCBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66dVFApGn+DyvmAcBDmU2fPNeSsFJXfH8N2QQA"
      >
        <track kind="captions" />
      </audio>
      
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center flex-1">
          {getTypeIcon()}
          <div className="flex-1">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="min"
                  min="1"
                  max="1440"
                  autoFocus
                />
                <span className="text-sm text-gray-600">minutes</span>
                <button
                  onClick={handleEditSave}
                  className="p-1 text-green-600 hover:text-green-700"
                  title="Save"
                >
                  <Save size={14} />
                </button>
                <button
                  onClick={handleEditCancel}
                  className="p-1 text-gray-600 hover:text-gray-700"
                  title="Cancel"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900">{getCustomLabel()}</h4>
                  <button
                    onClick={handleEditStart}
                    disabled={timerState.isRunning}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Edit timer duration"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 capitalize">
                  {timer.type}
                  {timerState.isPaused && " • Paused"}
                  {customMinutes !== timer.minutes && " • Custom"}
                </p>
              </>
            )}
          </div>
        </div>
        
        {timerState.isCompleted && (
          <AlertCircle className="text-red-500" size={20} />
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            ref={progressBarRef}
            className="h-2 rounded-full transition-all duration-300 bg-gray-400"
            style={{ width: '0%' }}
          />
        </div>
      </div>

      {/* Time display */}
      <div ref={timeDisplayRef} className="text-2xl font-mono font-bold text-center mb-4 text-gray-600">
        {formatTime(timerDataRef.current.remainingTime)}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            timerState.isRunning ? handlePause() : handleStart();
          }}
          disabled={!isInitialized}
          className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            timerState.isRunning
              ? 'bg-orange-600 text-white hover:bg-orange-700'
              : timerState.isCompleted
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-green-600 text-white hover:bg-green-700'
          } ${!isInitialized ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {timerState.isRunning ? (
            <Pause size={16} className="mr-1" />
          ) : (
            <Play size={16} className="mr-1" />
          )}
          {timerState.isRunning 
            ? 'Pause' 
            : timerState.isCompleted 
            ? 'Restart' 
            : timerState.isPaused 
            ? 'Resume' 
            : 'Start'
          }
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleReset();
          }}
          disabled={!isInitialized}
          className={`inline-flex items-center px-3 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors ${
            !isInitialized ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <RotateCcw size={16} className="mr-1" />
          Reset
        </button>
      </div>

      {/* Context info */}
      {timer.context && (
        <div 
          className={`mt-3 p-2 bg-gray-100 rounded text-xs text-gray-600 ${
            onContextClick && timer.contextStart !== -1 
              ? 'cursor-pointer hover:bg-gray-200 transition-colors' 
              : ''
          }`}
          onClick={() => onContextClick && timer.contextStart !== -1 && onContextClick(timer)}
          onKeyDown={onContextClick && timer.contextStart !== -1 ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onContextClick(timer);
            }
          } : undefined}
          role={onContextClick && timer.contextStart !== -1 ? "button" : undefined}
          tabIndex={onContextClick && timer.contextStart !== -1 ? 0 : undefined}
          title={onContextClick && timer.contextStart !== -1 ? "Click to jump to this part of the recipe" : undefined}
        >
          <strong>Context:</strong> {timer.context}
        </div>
      )}
    </div>
  );
}