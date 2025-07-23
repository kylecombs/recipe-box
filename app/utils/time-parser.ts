export interface DetectedTimer {
  id: string;
  label: string;
  minutes: number;
  originalText: string;
  context: string;
  type: 'cooking' | 'prep' | 'marinating' | 'resting' | 'chilling' | 'rising' | 'baking' | 'simmering' | 'boiling' | 'other';
}

export interface TimerState {
  id: string;
  isRunning: boolean;
  remainingTime: number; // in seconds
  startTime: number; // timestamp when started
  pausedTime?: number; // timestamp when paused
  totalDuration: number; // original duration in seconds
}

// Comprehensive time patterns
const TIME_PATTERNS = [
  // Standard formats: "30 minutes", "2 hours", "1 hour 30 minutes"
  /(\d+(?:\.\d+)?)\s*(?:to\s+\d+(?:\.\d+)?\s*)?(?:hours?|hrs?|h)\s*(?:and\s+)?(?:(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m))?/gi,
  /(\d+(?:\.\d+)?)\s*(?:to\s+\d+(?:\.\d+)?\s*)?(?:minutes?|mins?|m)(?!\w)/gi,
  
  // Range formats: "20-30 minutes", "2-3 hours"
  /(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|m|h)(?!\w)/gi,
  
  // Fractional formats: "1/2 hour", "1½ hours", "2¼ minutes"
  /(\d+)?\s*([¼½¾]|\d+\/\d+)\s*(minutes?|mins?|hours?|hrs?|m|h)(?!\w)/gi,
  
  // Digital format: "1:30", "0:45"
  /(\d+):(\d{2})\s*(?:minutes?|mins?|hours?|hrs?|m|h)?/gi,
  
  // Words: "fifteen minutes", "half an hour", "quarter hour"
  /(fifteen|thirty|forty-five|half|quarter)\s*(?:an?\s*)?(minutes?|mins?|hours?|hrs?|m|h)/gi,
  
  // Overnight, all day, etc.
  /(overnight|all\s+day|all\s+night)/gi,
];

// Time context patterns to identify the type of timer
const CONTEXT_PATTERNS = {
  cooking: [
    /cook(?:ing)?\s+(?:for\s+)?/i,
    /simmer(?:ing)?\s+(?:for\s+)?/i,
    /boil(?:ing)?\s+(?:for\s+)?/i,
    /fry(?:ing)?\s+(?:for\s+)?/i,
    /sauté(?:ing)?\s+(?:for\s+)?/i,
    /roast(?:ing)?\s+(?:for\s+)?/i,
    /grill(?:ing)?\s+(?:for\s+)?/i,
    /heat(?:ing)?\s+(?:for\s+)?/i,
  ],
  baking: [
    /bak(?:e|ing)\s+(?:for\s+)?/i,
    /in\s+(?:the\s+)?oven\s+(?:for\s+)?/i,
    /at\s+\d+°[CF]\s+(?:for\s+)?/i,
  ],
  prep: [
    /prep(?:are|aration)?\s+(?:for\s+)?/i,
    /chop(?:ping)?\s+(?:for\s+)?/i,
    /mix(?:ing)?\s+(?:for\s+)?/i,
    /knead(?:ing)?\s+(?:for\s+)?/i,
  ],
  marinating: [
    /marinat(?:e|ing)\s+(?:for\s+)?/i,
    /marinate?\s+(?:for\s+)?/i,
  ],
  resting: [
    /rest(?:ing)?\s+(?:for\s+)?/i,
    /let\s+(?:it\s+)?rest\s+(?:for\s+)?/i,
    /set\s+aside\s+(?:for\s+)?/i,
    /cool(?:ing)?\s+(?:for\s+)?/i,
  ],
  chilling: [
    /chill(?:ing)?\s+(?:for\s+)?/i,
    /refrigerat(?:e|ing)\s+(?:for\s+)?/i,
    /in\s+(?:the\s+)?(?:fridge|refrigerator)\s+(?:for\s+)?/i,
  ],
  rising: [
    /ris(?:e|ing)\s+(?:for\s+)?/i,
    /proof(?:ing)?\s+(?:for\s+)?/i,
    /let\s+(?:it\s+)?rise\s+(?:for\s+)?/i,
    /doubled?\s+in\s+size/i,
  ],
  simmering: [
    /simmer(?:ing)?\s+(?:for\s+)?/i,
    /gentle\s+simmer\s+(?:for\s+)?/i,
  ],
  boiling: [
    /boil(?:ing)?\s+(?:for\s+)?/i,
    /bring\s+to\s+(?:a\s+)?boil\s+(?:for\s+)?/i,
  ],
};

// Convert word numbers to digits
const WORD_TO_NUMBER: Record<string, number> = {
  'fifteen': 15,
  'thirty': 30,
  'forty-five': 45,
  'half': 0.5,
  'quarter': 0.25,
};

// Convert fractions to decimal
function parseFraction(fraction: string): number {
  if (fraction === '¼' || fraction === '1/4') return 0.25;
  if (fraction === '½' || fraction === '1/2') return 0.5;
  if (fraction === '¾' || fraction === '3/4') return 0.75;
  
  const parts = fraction.split('/');
  if (parts.length === 2) {
    return parseInt(parts[0]) / parseInt(parts[1]);
  }
  
  return 0;
}

// Convert time string to minutes
function parseTimeToMinutes(
  match: RegExpMatchArray, 
  patternIndex: number
): number {
  const matchText = match[0].toLowerCase();
  
  // Handle overnight, all day
  if (patternIndex === TIME_PATTERNS.length - 1) {
    if (matchText.includes('overnight')) return 480; // 8 hours
    if (matchText.includes('all day')) return 720; // 12 hours
    if (matchText.includes('all night')) return 480; // 8 hours
    return 60; // default 1 hour
  }
  
  // Handle word numbers
  if (patternIndex === TIME_PATTERNS.length - 2) {
    const word = match[1];
    const unit = match[2];
    const value = WORD_TO_NUMBER[word] || 1;
    
    if (unit.startsWith('h')) return value * 60;
    return value;
  }
  
  // Handle digital format (1:30)
  if (patternIndex === TIME_PATTERNS.length - 3) {
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    return hours * 60 + minutes;
  }
  
  // Handle fractional formats
  if (patternIndex === TIME_PATTERNS.length - 4) {
    const whole = parseInt(match[1] || '0');
    const fraction = parseFraction(match[2]);
    const unit = match[3];
    const value = whole + fraction;
    
    if (unit.toLowerCase().startsWith('h')) return value * 60;
    return value;
  }
  
  // Handle range formats (take the average)
  if (patternIndex === TIME_PATTERNS.length - 5) {
    const min = parseFloat(match[1]);
    const max = parseFloat(match[2]);
    const unit = match[3];
    const value = (min + max) / 2;
    
    if (unit.toLowerCase().startsWith('h')) return value * 60;
    return value;
  }
  
  // Handle standard formats and minutes only
  if (patternIndex <= 1) {
    const first = parseFloat(match[1] || '0');
    const second = parseFloat(match[2] || '0');
    
    if (patternIndex === 0) {
      // Hours and minutes format
      return first * 60 + second;
    } else {
      // Minutes only
      return first;
    }
  }
  
  return 0;
}

// Determine timer type from context
function determineTimerType(context: string): DetectedTimer['type'] {
  const lowerContext = context.toLowerCase();
  
  for (const [type, patterns] of Object.entries(CONTEXT_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(lowerContext))) {
      return type as DetectedTimer['type'];
    }
  }
  
  return 'other';
}

// Create a meaningful label for the timer
function createTimerLabel(
  originalText: string, 
  context: string, 
  type: DetectedTimer['type'], 
  minutes: number
): string {
  const timeStr = minutes >= 60 
    ? `${Math.floor(minutes / 60)}h ${minutes % 60 > 0 ? `${minutes % 60}m` : ''}`.trim()
    : `${minutes}m`;
  
  // Try to extract a more specific label from context
  const contextLower = context.toLowerCase();
  
  if (type === 'baking' && contextLower.includes('oven')) {
    return `Bake (${timeStr})`;
  }
  if (type === 'cooking' && contextLower.includes('simmer')) {
    return `Simmer (${timeStr})`;
  }
  if (type === 'cooking' && contextLower.includes('boil')) {
    return `Boil (${timeStr})`;
  }
  if (type === 'marinating') {
    return `Marinate (${timeStr})`;
  }
  if (type === 'resting') {
    return `Rest (${timeStr})`;
  }
  if (type === 'chilling') {
    return `Chill (${timeStr})`;
  }
  if (type === 'rising') {
    return `Rise (${timeStr})`;
  }
  
  // Default labels by type
  const typeLabels: Record<DetectedTimer['type'], string> = {
    cooking: 'Cook',
    prep: 'Prep',
    marinating: 'Marinate',
    resting: 'Rest',
    chilling: 'Chill',
    rising: 'Rise',
    baking: 'Bake',
    simmering: 'Simmer',
    boiling: 'Boil',
    other: 'Timer',
  };
  
  return `${typeLabels[type]} (${timeStr})`;
}

export function detectTimersFromText(text: string): DetectedTimer[] {
  const timers: DetectedTimer[] = [];
  const processedRanges: Array<[number, number]> = [];
  
  // Split text into sentences for better context
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  sentences.forEach((sentence, sentenceIndex) => {
    TIME_PATTERNS.forEach((pattern, patternIndex) => {
      let match;
      pattern.lastIndex = 0; // Reset regex state
      
      while ((match = pattern.exec(sentence)) !== null) {
        const minutes = parseTimeToMinutes(match, patternIndex);
        
        if (minutes > 0 && minutes <= 1440) { // Max 24 hours
          const matchStart = match.index;
          const matchEnd = match.index + match[0].length;
          
          // Check for overlapping matches
          const isOverlapping = processedRanges.some(([start, end]) => 
            (matchStart >= start && matchStart <= end) || 
            (matchEnd >= start && matchEnd <= end)
          );
          
          if (!isOverlapping) {
            // Get surrounding context (20 chars before and after)
            const contextStart = Math.max(0, matchStart - 20);
            const contextEnd = Math.min(sentence.length, matchEnd + 20);
            const context = sentence.slice(contextStart, contextEnd);
            
            const type = determineTimerType(context);
            const label = createTimerLabel(match[0], context, type, minutes);
            
            const timer: DetectedTimer = {
              id: `timer-${sentenceIndex}-${matchStart}-${Date.now()}`,
              label,
              minutes,
              originalText: match[0],
              context: context.trim(),
              type,
            };
            
            timers.push(timer);
            processedRanges.push([matchStart, matchEnd]);
          }
        }
      }
    });
  });
  
  // Remove duplicate timers (same duration and similar context)
  const uniqueTimers = timers.filter((timer, index) => {
    return !timers.slice(0, index).some(existingTimer => 
      existingTimer.minutes === timer.minutes && 
      existingTimer.type === timer.type &&
      Math.abs(existingTimer.context.length - timer.context.length) < 10
    );
  });
  
  // Sort by duration (shortest first)
  return uniqueTimers.sort((a, b) => a.minutes - b.minutes);
}

export function detectTimersFromRecipe(
  title: string = '',
  description: string = '',
  instructions: string[] = [],
  prepTime?: number,
  cookTime?: number
): DetectedTimer[] {
  const allText = [
    title,
    description,
    ...instructions,
  ].join(' ');
  
  const detectedTimers = detectTimersFromText(allText);
  
  // Add prep and cook times from recipe metadata
  const metadataTimers: DetectedTimer[] = [];
  
  if (prepTime && prepTime > 0) {
    metadataTimers.push({
      id: `prep-time-${Date.now()}`,
      label: `Prep Time (${prepTime}m)`,
      minutes: prepTime,
      originalText: `${prepTime} minutes`,
      context: 'Recipe preparation time',
      type: 'prep',
    });
  }
  
  if (cookTime && cookTime > 0) {
    metadataTimers.push({
      id: `cook-time-${Date.now()}`,
      label: `Cook Time (${cookTime}m)`,
      minutes: cookTime,
      originalText: `${cookTime} minutes`,
      context: 'Recipe cooking time',
      type: 'cooking',
    });
  }
  
  // Combine and deduplicate
  const allTimers = [...metadataTimers, ...detectedTimers];
  
  return allTimers.filter((timer, index) => {
    return !allTimers.slice(0, index).some(existingTimer => 
      Math.abs(existingTimer.minutes - timer.minutes) <= 1 && 
      existingTimer.type === timer.type
    );
  });
}