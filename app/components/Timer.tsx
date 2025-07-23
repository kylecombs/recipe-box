import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Clock, AlertCircle } from "lucide-react";
import type { DetectedTimer, TimerState } from "~/utils/time-parser";

interface TimerProps {
  timer: DetectedTimer;
  onStateChange?: (state: TimerState) => void;
  initialState?: TimerState;
}

export default function Timer({ timer, onStateChange, initialState }: TimerProps) {
  const [state, setState] = useState<TimerState>(() => {
    if (initialState) {
      return initialState;
    }
    return {
      id: timer.id,
      isRunning: false,
      remainingTime: timer.minutes * 60, // Convert to seconds
      startTime: 0,
      totalDuration: timer.minutes * 60,
    };
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Update parent component when state changes
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  // Handle timer countdown
  useEffect(() => {
    if (state.isRunning && state.remainingTime > 0) {
      intervalRef.current = setInterval(() => {
        setState(prevState => {
          const now = Date.now();
          const elapsed = Math.floor((now - prevState.startTime) / 1000);
          const newRemainingTime = Math.max(0, prevState.totalDuration - elapsed);
          
          return {
            ...prevState,
            remainingTime: newRemainingTime,
          };
        });
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
      }
    };
  }, [state.isRunning, state.remainingTime, state.startTime, state.totalDuration]);

  // Handle timer completion
  useEffect(() => {
    if (state.isRunning && state.remainingTime === 0) {
      setState(prev => ({ ...prev, isRunning: false }));
      
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
  }, [state.isRunning, state.remainingTime, timer.label, timer.type]);

  const handleStart = () => {
    if (state.remainingTime === 0) {
      // Reset if timer is at 0
      handleReset();
      return;
    }

    const now = Date.now();
    let startTime = now;
    const remainingTime = state.remainingTime;

    // If resuming from pause, calculate correct start time
    if (state.pausedTime) {
      startTime = now - (state.totalDuration - remainingTime) * 1000;
    } else if (!state.startTime) {
      // First time starting
      startTime = now;
    } else {
      // Already has a start time, keep it
      startTime = state.startTime;
    }

    setState(prev => ({
      ...prev,
      isRunning: true,
      startTime,
      pausedTime: undefined,
    }));

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const handlePause = () => {
    setState(prev => ({
      ...prev,
      isRunning: false,
      pausedTime: Date.now(),
    }));
  };

  const handleReset = () => {
    setState({
      id: timer.id,
      isRunning: false,
      remainingTime: timer.minutes * 60,
      startTime: 0,
      totalDuration: timer.minutes * 60,
    });
  };

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
    return ((state.totalDuration - state.remainingTime) / state.totalDuration) * 100;
  };

  const getTimerColor = (): string => {
    if (state.remainingTime === 0) return 'text-red-600';
    if (state.isRunning) return 'text-green-600';
    return 'text-gray-600';
  };

  const getBackgroundColor = (): string => {
    if (state.remainingTime === 0) return 'bg-red-50 border-red-200';
    if (state.isRunning) return 'bg-green-50 border-green-200';
    return 'bg-gray-50 border-gray-200';
  };

  const getTypeIcon = () => {
    const iconProps = { size: 16, className: "mr-2" };
    
    switch (timer.type) {
      case 'baking':
      case 'cooking':
        return <Clock {...iconProps} />;
      case 'marinating':
      case 'chilling':
        return <Clock {...iconProps} />;
      case 'resting':
      case 'rising':
        return <Clock {...iconProps} />;
      default:
        return <Clock {...iconProps} />;
    }
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
            <p className="text-xs text-gray-500 capitalize">{timer.type}</p>
          </div>
        </div>
        
        {state.remainingTime === 0 && (
          <AlertCircle className="text-red-500" size={20} />
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-1000 ${
              state.remainingTime === 0
                ? 'bg-red-500'
                : state.isRunning
                ? 'bg-green-500'
                : 'bg-gray-400'
            }`}
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
      </div>

      {/* Time display */}
      <div className={`text-2xl font-mono font-bold text-center mb-4 ${getTimerColor()}`}>
        {formatTime(state.remainingTime)}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-2">
        <button
          onClick={state.isRunning ? handlePause : handleStart}
          className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            state.isRunning
              ? 'bg-orange-600 text-white hover:bg-orange-700'
              : state.remainingTime === 0
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {state.isRunning ? (
            <Pause size={16} className="mr-1" />
          ) : (
            <Play size={16} className="mr-1" />
          )}
          {state.isRunning ? 'Pause' : state.remainingTime === 0 ? 'Restart' : 'Start'}
        </button>
        
        <button
          onClick={handleReset}
          className="inline-flex items-center px-3 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          <RotateCcw size={16} className="mr-1" />
          Reset
        </button>
      </div>

      {/* Context info */}
      {timer.context && (
        <div className="mt-3 p-2 bg-gray-100 rounded text-xs text-gray-600">
          <strong>Context:</strong> {timer.context}
        </div>
      )}
    </div>
  );
}