import { useState, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import type { DetectedTimer } from "~/utils/time-parser";

interface HighlightableTextProps {
  text: string;
  timers: DetectedTimer[];
  className?: string;
  onTimerClick?: (timer: DetectedTimer) => void;
}

export interface HighlightableTextRef {
  scrollToTimer: (timer: DetectedTimer) => void;
}

const HighlightableText = forwardRef<HighlightableTextRef, HighlightableTextProps>(
  ({ text, timers, className = "", onTimerClick }, ref) => {
    const textRef = useRef<HTMLDivElement>(null);
    const [highlightedTimer, setHighlightedTimer] = useState<string | null>(null);

    // Function to scroll to and highlight a specific timer's context
    const scrollToTimer = useCallback((timer: DetectedTimer) => {
      if (!textRef.current || timer.contextStart === -1) return;

      // Scroll to this component first
      textRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      // Highlight the timer
      setHighlightedTimer(timer.id);
      
      // Remove highlight after animation
      setTimeout(() => {
        setHighlightedTimer(null);
      }, 3000);
    }, []);

    // Expose scrollToTimer to parent components
    useImperativeHandle(ref, () => ({
      scrollToTimer
    }));

    // Create segments for rendering with highlights
    const createTextSegments = useCallback(() => {
      if (timers.length === 0) {
        return [{ text, isHighlight: false, timerId: null }];
      }

      // Sort timers by start position
      const sortedTimers = [...timers]
        .filter(timer => timer.contextStart !== -1 && timer.contextStart >= 0)
        .sort((a, b) => a.contextStart - b.contextStart);

      const segments: Array<{
        text: string;
        isHighlight: boolean;
        timerId: string | null;
        contextStart: number;
        contextEnd: number;
      }> = [];

      let currentPos = 0;

      sortedTimers.forEach(timer => {
        // Ensure positions are within text bounds
        const start = Math.max(0, Math.min(timer.contextStart, text.length));
        const end = Math.max(start, Math.min(timer.contextEnd, text.length));

        // Add text before this timer's context
        if (start > currentPos) {
          segments.push({
            text: text.slice(currentPos, start),
            isHighlight: false,
            timerId: null,
            contextStart: currentPos,
            contextEnd: start,
          });
        }

        // Add the timer's context as a highlight
        if (end > start) {
          segments.push({
            text: text.slice(start, end),
            isHighlight: true,
            timerId: timer.id,
            contextStart: start,
            contextEnd: end,
          });
        }

        currentPos = Math.max(currentPos, end);
      });

      // Add remaining text
      if (currentPos < text.length) {
        segments.push({
          text: text.slice(currentPos),
          isHighlight: false,
          timerId: null,
          contextStart: currentPos,
          contextEnd: text.length,
        });
      }

      return segments;
    }, [text, timers]);

    const segments = createTextSegments();

    // Handle clicking on a timer segment
    const handleTimerClick = useCallback((segment: typeof segments[0]) => {
      if (segment.isHighlight && segment.timerId && onTimerClick) {
        const timer = timers.find(t => t.id === segment.timerId);
        if (timer) {
          onTimerClick(timer);
        }
      }
    }, [timers, onTimerClick]);

    return (
      <div ref={textRef} className={className}>
        {segments.map((segment, index) => (
          <span
            key={index}
            className={`${
              segment.isHighlight
                ? `cursor-pointer hover:bg-yellow-100 rounded px-1 transition-all duration-500 ${
                    highlightedTimer === segment.timerId
                      ? 'bg-yellow-300 shadow-sm'
                      : 'bg-yellow-50'
                  }`
                : ''
            }`}
            onClick={() => handleTimerClick(segment)}
            onKeyDown={segment.isHighlight ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleTimerClick(segment);
              }
            } : undefined}
            role={segment.isHighlight ? "button" : undefined}
            tabIndex={segment.isHighlight ? 0 : undefined}
          >
            {segment.text}
          </span>
        ))}
      </div>
    );
  }
);

HighlightableText.displayName = 'HighlightableText';

export default HighlightableText;