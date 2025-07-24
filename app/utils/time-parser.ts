export interface DetectedTimer {
  id: string;
  label: string;
  minutes: number;
  originalText: string;
  context: string;
  type: 'broil' | 'bake' | 'cook' | 'simmer' | 'boil' | 'fry' | 'saute' | 'roast' | 'grill' | 'steam' | 'braise' | 'toast' | 'heat' | 'prep' | 'marinate' | 'rest' | 'chill' | 'rise' | 'other';
  // Position information for linking to recipe text
  contextStart: number; // Start position of context in original text
  contextEnd: number;   // End position of context in original text
  timerStart: number;   // Start position of timer text within context
  timerEnd: number;     // End position of timer text within context
}

export interface TimerState {
  id: string;
  isRunning: boolean;
  remainingTime: number; // in seconds
  startTime: number; // timestamp when started
  pausedTime?: number; // timestamp when paused
  totalDuration: number; // original duration in seconds
  endTimestamp?: number; // timestamp when timer should end (for persistence)
  isPaused?: boolean; // explicit pause state for cookie persistence
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

// Time context patterns to identify the type of timer and extract specific cooking verbs
// Order matters! More specific patterns should come first to avoid generic matches
const CONTEXT_PATTERNS = {
  // Specific cooking methods - check these first
  broil: [
    /broil(?:ing)?\s+(?:for\s+)?/i,
    /under\s+(?:the\s+)?broiler\s+(?:for\s+)?/i,
  ],
  simmer: [
    /simmer(?:ing)?\s*,?\s*(?:stirring\s+)?(?:occasionally|frequently)?\s*,?\s*(?:until|for)/i,
    /(?:and\s+)?simmer(?:ing)?\s+(?:for\s+)?/i,
    /gentle\s+simmer\s+(?:for\s+)?/i,
  ],
  boil: [
    /(?:bring\s+to\s+(?:a\s+)?)?boil(?:ing)?\s*,?\s*(?:then|and)?\s*(?:reduce\s+heat\s+)?(?:for\s+)?/i,
    /boil(?:ing)?\s+(?:for\s+)?/i,
  ],
  bake: [
    /bak(?:e|ing)\s+(?:for\s+)?/i,
    /in\s+(?:the\s+)?oven\s+(?:for\s+)?/i,
    /at\s+\d+°[CF]\s+(?:for\s+)?/i,
  ],
  fry: [
    /fry(?:ing)?\s+(?:for\s+)?/i,
    /deep.fry(?:ing)?\s+(?:for\s+)?/i,
  ],
  saute: [
    /sauté(?:ing)?\s+(?:for\s+)?/i,
    /saute(?:ing)?\s+(?:for\s+)?/i,
  ],
  roast: [
    /roast(?:ing)?\s+(?:for\s+)?/i,
  ],
  grill: [
    /grill(?:ing)?\s+(?:for\s+)?/i,
  ],
  steam: [
    /steam(?:ing)?\s+(?:for\s+)?/i,
  ],
  braise: [
    /brais(?:e|ing)\s+(?:for\s+)?/i,
  ],
  toast: [
    /toast(?:ing)?\s+(?:for\s+)?/i,
  ],
  marinate: [
    /marinat(?:e|ing)\s+(?:for\s+)?/i,
  ],
  rise: [
    /ris(?:e|ing)\s+(?:for\s+)?/i,
    /proof(?:ing)?\s+(?:for\s+)?/i,
    /let\s+(?:it\s+)?rise\s+(?:for\s+)?/i,
    /doubled?\s+in\s+size/i,
  ],
  chill: [
    /chill(?:ing)?\s+(?:for\s+)?/i,
    /refrigerat(?:e|ing)\s+(?:for\s+)?/i,
    /in\s+(?:the\s+)?(?:fridge|refrigerator)\s+(?:for\s+)?/i,
  ],
  rest: [
    /rest(?:ing)?\s+(?:for\s+)?/i,
    /let\s+(?:it\s+)?rest\s+(?:for\s+)?/i,
    /set\s+aside\s+(?:for\s+)?/i,
    /cool(?:ing)?\s+(?:for\s+)?/i,
  ],
  prep: [
    /prep(?:are|aration)?\s+(?:for\s+)?/i,
    /chop(?:ping)?\s+(?:for\s+)?/i,
    /mix(?:ing)?\s+(?:for\s+)?/i,
    /knead(?:ing)?\s+(?:for\s+)?/i,
  ],
  
  // Generic patterns - check these last
  cook: [
    /cook(?:ing)?\s+(?:for\s+)?/i,
  ],
  heat: [
    /(?:^|\s)heat(?:ing)?\s+(?:for\s+)?/i, // More specific - must be at start or after space
    /warm(?:ing)?\s+(?:for\s+)?/i,
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
  
  // Labels that correspond directly to the specific cooking verbs
  const typeLabels: Record<DetectedTimer['type'], string> = {
    broil: 'Broil',
    bake: 'Bake',
    cook: 'Cook',
    simmer: 'Simmer',
    boil: 'Boil',
    fry: 'Fry',
    saute: 'Sauté',
    roast: 'Roast',
    grill: 'Grill',
    steam: 'Steam',
    braise: 'Braise',
    toast: 'Toast',
    heat: 'Heat',
    prep: 'Prep',
    marinate: 'Marinate',
    rest: 'Rest',
    chill: 'Chill',
    rise: 'Rise',
    other: 'Timer',
  };
  
  return `${typeLabels[type]} (${timeStr})`;
}

export function detectTimersFromText(text: string): DetectedTimer[] {
  const timers: DetectedTimer[] = [];
  const processedRanges: Array<[number, number]> = [];
  
  // Work with the full text instead of splitting into sentences
  TIME_PATTERNS.forEach((pattern, patternIndex) => {
    let match;
    pattern.lastIndex = 0; // Reset regex state
    
    while ((match = pattern.exec(text)) !== null) {
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
          // Find the complete sentence or meaningful phrase containing the timer
          let contextStart = matchStart;
          let contextEnd = matchEnd;
          
          // Look backwards for the start of the current sentence or meaningful phrase
          let searchStart = Math.max(0, matchStart - 150);
          const beforeText = text.slice(searchStart, matchStart);
          
          // Try to find sentence boundary first
          const sentenceMatch = beforeText.match(/[.!?]\s+([^.!?]*)$/);
          if (sentenceMatch && sentenceMatch[1].length > 10) {
            // Found a sentence - use it
            contextStart = searchStart + sentenceMatch.index + sentenceMatch[0].indexOf(sentenceMatch[1]);
          } else {
            // No good sentence boundary, look for clause boundaries
            const clauseMatch = beforeText.match(/[,;:]\s+([^,;:.]*)$/);
            if (clauseMatch && clauseMatch[1].length > 10) {
              contextStart = searchStart + clauseMatch.index + clauseMatch[0].indexOf(clauseMatch[1]);
            } else {
              // Fallback: go back to find a reasonable phrase start
              const wordMatch = beforeText.match(/\s+(\S.*)$/);
              if (wordMatch) {
                contextStart = searchStart + wordMatch.index + 1;
              } else {
                contextStart = searchStart;
              }
            }
          }
          
          // Look forward for the end of the sentence or meaningful phrase
          let searchEnd = Math.min(text.length, matchEnd + 100);
          const afterText = text.slice(matchEnd, searchEnd);
          
          // Try to find sentence end
          const sentenceEndMatch = afterText.match(/^([^.!?]*[.!?])/);
          if (sentenceEndMatch) {
            contextEnd = matchEnd + sentenceEndMatch[0].length;
          } else {
            // Look for clause end
            const clauseEndMatch = afterText.match(/^([^,;]{0,50}[,;])/);
            if (clauseEndMatch) {
              contextEnd = matchEnd + clauseEndMatch[0].length;
            } else {
              // Fallback: reasonable phrase end
              const wordEndMatch = afterText.match(/^(.{10,50})\s/);
              if (wordEndMatch) {
                contextEnd = matchEnd + wordEndMatch[1].length;
              } else {
                contextEnd = Math.min(text.length, matchEnd + 30);
              }
            }
          }
          
          // Extract the context
          let context = text.slice(contextStart, contextEnd).trim();
          
          // Clean up the context start - ensure it starts properly
          if (context.length > 0 && /^[a-z]/.test(context)) {
            // Find the actual word start
            let wordStart = contextStart;
            while (wordStart > 0 && /[a-zA-Z]/.test(text[wordStart - 1])) {
              wordStart--;
            }
            if (contextStart - wordStart < 15) {
              contextStart = wordStart;
              context = text.slice(contextStart, contextEnd).trim();
            }
          }
          
          // Limit context length for readability (but allow more than before)
          if (context.length > 120) {
            // Find a good break point
            const breakPoint = context.lastIndexOf(' ', 100);
            if (breakPoint > 50) {
              context = context.slice(0, breakPoint).trim() + '...';
            } else {
              context = context.slice(0, 100).trim() + '...';
            }
          }
          
          // Remove any leading punctuation that might be left over
          context = context.replace(/^[,;:]\s*/, '');
          
          const type = determineTimerType(context);
          const label = createTimerLabel(match[0], context, type, minutes);
          
          // Calculate timer position within the context
          const timerInContextStart = context.indexOf(match[0]);
          const timerInContextEnd = timerInContextStart + match[0].length;
          
          // Create a stable ID based on content, not timestamp
          const contentHash = `${matchStart}-${match[0]}-${minutes}`;
          const timer: DetectedTimer = {
            id: `timer-${contentHash}`,
            label,
            minutes,
            originalText: match[0],
            context: context,
            type,
            // Position information for recipe text linking
            contextStart,
            contextEnd,
            timerStart: timerInContextStart,
            timerEnd: timerInContextEnd,
          };
          
          timers.push(timer);
          processedRanges.push([matchStart, matchEnd]);
        }
      }
    }
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
  cookTime?: number,
  recipeId?: string
): DetectedTimer[] {
  const allText = [
    title,
    description,
    ...instructions,
  ].join(' ');
  
  const detectedTimers = detectTimersFromText(allText).map(timer => ({
    ...timer,
    id: recipeId ? `${recipeId}-${timer.id}` : timer.id,
  }));
  
  // Add prep and cook times from recipe metadata
  const metadataTimers: DetectedTimer[] = [];
  
  if (prepTime && prepTime > 0) {
    metadataTimers.push({
      id: recipeId ? `${recipeId}-prep-time-${prepTime}` : `prep-time-${prepTime}`,
      label: `Prep Time (${prepTime}m)`,
      minutes: prepTime,
      originalText: `${prepTime} minutes`,
      context: 'Recipe preparation time',
      type: 'prep',
      // Metadata timers don't have specific text positions
      contextStart: -1,
      contextEnd: -1,
      timerStart: -1,
      timerEnd: -1,
    });
  }
  
  if (cookTime && cookTime > 0) {
    metadataTimers.push({
      id: recipeId ? `${recipeId}-cook-time-${cookTime}` : `cook-time-${cookTime}`,
      label: `Cook Time (${cookTime}m)`,
      minutes: cookTime,
      originalText: `${cookTime} minutes`,
      context: 'Recipe cooking time',
      type: 'cook',
      // Metadata timers don't have specific text positions
      contextStart: -1,
      contextEnd: -1,
      timerStart: -1,
      timerEnd: -1,
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