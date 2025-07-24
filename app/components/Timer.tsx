import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Clock, AlertCircle } from "lucide-react";
import type { DetectedTimer, TimerState } from "~/utils/time-parser";

interface TimerProps {
  timer: DetectedTimer;
  onStateChange?: (state: TimerState) => void;
  initialState?: TimerState;
  onContextClick?: (timer: DetectedTimer) => void;
}

export default function Timer({ timer, onStateChange, initialState, onContextClick }: TimerProps) {
  const totalDurationMs = timer.minutes * 60 * 1000; // Convert to milliseconds
  const storageKey = `timer_${timer.id}`;
  const pausedStorageKey = `${storageKey}_paused`;
  
  const [timerData, setTimerData] = useState(() => {
    return {
      date: Date.now(),
      delay: totalDurationMs,
      isRunning: false,
      isPaused: false,
    };
  });

  const [remainingTime, setRemainingTime] = useState(Math.floor(totalDurationMs / 1000));
  const [isInitialized, setIsInitialized] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Helper function to get value from localStorage
  const getLocalStorageValue = (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  };

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

  // Initialize timer state from localStorage on mount
  useEffect(() => {
    const savedEndDate = getLocalStorageValue(storageKey);
    const pausedData = getLocalStorageValue(pausedStorageKey);
    
    if (pausedData) {
      // Timer was paused
      try {
        const pausedInfo = JSON.parse(pausedData);
        const remaining = Math.floor(pausedInfo.remainingTime / 1000);
        setRemainingTime(remaining);
        setTimerData({
          date: Date.now(),
          delay: pausedInfo.remainingTime,
          isRunning: false,
          isPaused: true,
        });
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
        setRemainingTime(0);
        setTimerData({
          date: currentTime,
          delay: 0,
          isRunning: false,
          isPaused: false,
        });
        removeLocalStorageValue(storageKey);
      } else {
        // Timer is still running - restore the running state
        const remaining = Math.floor(delta / 1000);
        setRemainingTime(remaining);
        setTimerData({
          date: currentTime,
          delay: delta,
          isRunning: true,
          isPaused: false,
        });
      }
    } else if (initialState) {
      // Use initial state if provided and no saved state
      setRemainingTime(initialState.remainingTime);
      setTimerData({
        date: initialState.startTime || Date.now(),
        delay: initialState.remainingTime * 1000,
        isRunning: initialState.isRunning,
        isPaused: initialState.isPaused || false,
      });
    }
    
    setIsInitialized(true);
  }, []); // Only run once on mount

  // Timer countdown effect - only start after initialization
  useEffect(() => {
    if (!isInitialized) return;

    if (timerData.isRunning && !timerData.isPaused) {
      intervalRef.current = setInterval(() => {
        const savedEndDate = getLocalStorageValue(storageKey);
        if (savedEndDate) {
          const currentTime = Date.now();
          const endTime = parseInt(savedEndDate, 10);
          const remaining = Math.max(0, Math.floor((endTime - currentTime) / 1000));
          
          setRemainingTime(remaining);
          
          if (remaining === 0) {
            // Timer completed
            setTimerData(prev => ({ ...prev, isRunning: false }));
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
          }
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isInitialized, timerData.isRunning, timerData.isPaused, storageKey, timer.label, timer.type]);

  // Update parent component when state changes
  useEffect(() => {
    if (onStateChange && isInitialized) {
      onStateChange({
        id: timer.id,
        isRunning: timerData.isRunning,
        remainingTime,
        startTime: timerData.date,
        totalDuration: Math.floor(totalDurationMs / 1000),
        isPaused: timerData.isPaused,
      });
    }
  }, [timerData, remainingTime, timer.id, totalDurationMs, onStateChange, isInitialized]);

  const handleStart = useCallback(() => {
    if (remainingTime === 0) {
      // Reset timer if it's at 0
      handleReset();
      return;
    }

    const now = Date.now();
    const endTime = now + (remainingTime * 1000);
    
    // Save end time to localStorage
    setLocalStorageValue(storageKey, endTime.toString());
    
    // Clear any paused state
    removeLocalStorageValue(pausedStorageKey);

    setTimerData({
      date: now,
      delay: remainingTime * 1000,
      isRunning: true,
      isPaused: false,
    });

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [remainingTime, storageKey, pausedStorageKey]);

  const handlePause = useCallback(() => {
    // Save paused state with remaining time
    const pausedInfo = {
      remainingTime: remainingTime * 1000,
      pausedAt: Date.now(),
    };
    setLocalStorageValue(pausedStorageKey, JSON.stringify(pausedInfo));
    
    // Remove running timer end date
    removeLocalStorageValue(storageKey);

    setTimerData(prev => ({
      ...prev,
      isRunning: false,
      isPaused: true,
    }));
  }, [remainingTime, storageKey, pausedStorageKey]);

  const handleReset = useCallback(() => {
    // Clear all localStorage for this timer
    removeLocalStorageValue(storageKey);
    removeLocalStorageValue(pausedStorageKey);

    const resetTime = Math.floor(totalDurationMs / 1000);
    setRemainingTime(resetTime);
    setTimerData({
      date: Date.now(),
      delay: totalDurationMs,
      isRunning: false,
      isPaused: false,
    });
  }, [storageKey, pausedStorageKey, totalDurationMs]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    const totalSeconds = Math.floor(totalDurationMs / 1000);
    return ((totalSeconds - remainingTime) / totalSeconds) * 100;
  };

  const getTimerColor = (): string => {
    if (remainingTime === 0) return 'text-red-600';
    if (timerData.isRunning) return 'text-green-600';
    if (timerData.isPaused) return 'text-orange-600';
    return 'text-gray-600';
  };

  const getBackgroundColor = (): string => {
    if (remainingTime === 0) return 'bg-red-50 border-red-200';
    if (timerData.isRunning) return 'bg-green-50 border-green-200';
    if (timerData.isPaused) return 'bg-orange-50 border-orange-200';
    return 'bg-gray-50 border-gray-200';
  };

  const getTypeIcon = () => {
    const iconProps = { size: 16, className: "mr-2" };
    
    // All timer types use the Clock icon for now
    // Could be enhanced later with specific icons for different cooking methods
    return <Clock {...iconProps} />;
  };

  return (
    <div className={`rounded-lg border p-4 transition-colors ${getBackgroundColor()}`}>
      {/* Hidden audio element for notification */}
      <audio
        ref={audioRef}
        preload="auto"
        src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66dVFApGn+DyvmAcBDmU2fPNeSsFJXfH8N2QQAoUXrTp66dVFApGn+DyvmAcBDmU2fPNeSsFJXfH8N2QQAoCBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66dVFApGn+DyvmAcBDmU2fPNeSsFJXfH8N2QQA"
      >
        <track kind="captions" />
      </audio>
      
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          {getTypeIcon()}
          <div>
            <h4 className="font-medium text-gray-900">{timer.label}</h4>
            <p className="text-xs text-gray-500 capitalize">
              {timer.type}
              {timerData.isPaused && " • Paused"}
            </p>
          </div>
        </div>
        
        {remainingTime === 0 && (
          <AlertCircle className="text-red-500" size={20} />
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-1000 ${
              remainingTime === 0
                ? 'bg-red-500'
                : timerData.isRunning
                ? 'bg-green-500'
                : timerData.isPaused
                ? 'bg-orange-500'
                : 'bg-gray-400'
            }`}
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
      </div>

      {/* Time display */}
      <div className={`text-2xl font-mono font-bold text-center mb-4 ${getTimerColor()}`}>
        {formatTime(remainingTime)}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-2">
        <button
          onClick={timerData.isRunning ? handlePause : handleStart}
          disabled={!isInitialized}
          className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            timerData.isRunning
              ? 'bg-orange-600 text-white hover:bg-orange-700'
              : remainingTime === 0
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-green-600 text-white hover:bg-green-700'
          } ${!isInitialized ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {timerData.isRunning ? (
            <Pause size={16} className="mr-1" />
          ) : (
            <Play size={16} className="mr-1" />
          )}
          {timerData.isRunning 
            ? 'Pause' 
            : remainingTime === 0 
            ? 'Restart' 
            : timerData.isPaused 
            ? 'Resume' 
            : 'Start'
          }
        </button>
        
        <button
          onClick={handleReset}
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
          title={onContextClick && timer.contextStart !== -1 ? "Click to jump to this part of the recipe" : undefined}
        >
          <strong>Context:</strong> {timer.context}
        </div>
      )}
    </div>
  );
}