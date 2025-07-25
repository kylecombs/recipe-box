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
  
  // Overnight, all day, etc. (these will be excluded from timer creation)
  /(overnight|all\s+day|all\s+night)/gi,
];

// Time context patterns to identify the type of timer and extract specific cooking verbs
// Order matters! More specific patterns should come first to avoid generic matches
const CONTEXT_PATTERNS = {
  // Specific cooking methods - check these first
  broil: [
    /broil(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
    /under\s+(?:the\s+)?broiler\s+(?:for\s+)?/i,
  ],
  simmer: [
    /simmer(?:ing)?(?:\s*,\s*|\s+)(?:stirring\s+)?(?:occasionally|frequently)?(?:\s*,\s*)?\s*(?:until|for)/i,
    /(?:and\s+)?simmer(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
    /gentle\s+simmer(?:\s*,\s*|\s+)(?:for\s+)?/i,
  ],
  boil: [
    /(?:bring\s+to\s+(?:a\s+)?)?boil(?:ing)?(?:\s*,\s*|\s+)(?:then|and)?(?:\s*,\s*)?\s*(?:reduce\s+heat\s+)?(?:for\s+)?/i,
    /boil(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
  ],
  bake: [
    /bak(?:e|ing)(?:\s*,\s*|\s+)(?:for\s+)?/i,
    /in\s+(?:the\s+)?oven(?:\s*,\s*|\s+)(?:for\s+)?/i,
    /at\s+\d+°[CF](?:\s*,\s*|\s+)(?:for\s+)?/i,
  ],
  fry: [
    /fry(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
    /deep.fry(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
  ],
  saute: [
    /sauté(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
    /saute(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
  ],
  roast: [
    /roast(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
  ],
  grill: [
    /grill(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
  ],
  steam: [
    /steam(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
  ],
  braise: [
    /brais(?:e|ing)(?:\s*,\s*|\s+)(?:for\s+)?/i,
  ],
  toast: [
    /toast(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
  ],
  marinate: [
    /marinat(?:e|ing)(?:\s*,\s*|\s+)(?:for\s+)?/i,
  ],
  rise: [
    /ris(?:e|ing)(?:\s*,\s*|\s+)(?:for\s+)?/i,
    /proof(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
    /let\s+(?:it\s+)?rise(?:\s*,\s*|\s+)(?:for\s+)?/i,
    /doubled?\s+in\s+size/i,
  ],
  chill: [
    /chill(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
    /refrigerat(?:e|ing)(?:\s*,\s*|\s+)(?:for\s+)?/i,
    /in\s+(?:the\s+)?(?:fridge|refrigerator)(?:\s*,\s*|\s+)(?:for\s+)?/i,
  ],
  rest: [
    /rest(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
    /let\s+(?:it\s+)?rest(?:\s*,\s*|\s+)(?:for\s+)?/i,
    /set\s+aside(?:\s*,\s*|\s+)(?:for\s+)?/i,
    /cool(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
  ],
  prep: [
    /prep(?:are|aration)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
    /chop(?:ping)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
    /mix(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
    /knead(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
  ],
  
  // Generic patterns - check these last
  cook: [
    /cook(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
  ],
  heat: [
    /(?:^|\s)heat(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i, // More specific - must be at start or after space
    /warm(?:ing)?(?:\s*,\s*|\s+)(?:for\s+)?/i,
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
  
  // Handle overnight, all day - but return 0 to exclude these from timer creation
  if (patternIndex === TIME_PATTERNS.length - 1) {
    // These are long-duration activities that aren't suitable for active timers
    return 0; // Return 0 to exclude from timer creation
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
          const searchStart = Math.max(0, matchStart - 150);
          const beforeText = text.slice(searchStart, matchStart);
          
          // Look for cooking verbs that should be included in the context
          const cookingVerbs = /\b(cook|bake|broil|simmer|boil|fry|sauté|saute|roast|grill|steam|braise|toast|heat|warm)\b/gi;
          
          // First, look for any cooking verbs in the area before the timer
          const extendedBeforeText = text.slice(Math.max(0, matchStart - 150), matchStart);
          const cookingVerbMatches = [...extendedBeforeText.matchAll(cookingVerbs)];
          
          let defaultContextStart = searchStart;
          
          // Try to find sentence boundary first
          const sentenceMatch = beforeText.match(/[.!?]\s+([^.!?]*)$/);
          if (sentenceMatch && sentenceMatch[1].length > 10 && sentenceMatch.index !== undefined) {
            // Found a sentence - use it
            defaultContextStart = searchStart + sentenceMatch.index + sentenceMatch[0].indexOf(sentenceMatch[1]);
          } else {
            // Look for clause boundaries, but be careful with cooking verbs
            const clauseMatch = beforeText.match(/[,;:]\s+([^,;:.]*)$/);
            if (clauseMatch && clauseMatch[1].length > 10 && clauseMatch.index !== undefined) {
              const potentialStart = searchStart + clauseMatch.index + clauseMatch[0].indexOf(clauseMatch[1]);
              // Check if we're cutting off a cooking verb
              const beforeClause = text.slice(Math.max(0, potentialStart - 10), potentialStart);
              if (cookingVerbs.test(beforeClause)) {
                // Don't use this clause boundary, it would cut off a cooking verb
                // Fall through to standard fallback
                const wordMatch = beforeText.match(/\s+(\S.*)$/);
                if (wordMatch && wordMatch.index !== undefined) {
                  defaultContextStart = searchStart + wordMatch.index + 1;
                }
              } else {
                defaultContextStart = potentialStart;
              }
            } else {
              // Standard fallback
              const wordMatch = beforeText.match(/\s+(\S.*)$/);
              if (wordMatch && wordMatch.index !== undefined) {
                defaultContextStart = searchStart + wordMatch.index + 1;
              }
            }
          }
          
          // Now check if there's a cooking verb that should be included
          if (cookingVerbMatches.length > 0) {
            // Find the last cooking verb before the timer
            const lastVerbMatch = cookingVerbMatches[cookingVerbMatches.length - 1];
            const verbPosition = Math.max(0, matchStart - 150) + lastVerbMatch.index;
            
            // Check if the default context start would cut off a cooking verb
            // This handles cases like "Cook, stirring..." where the comma causes issues
            if (verbPosition < defaultContextStart) {
              // Check if there's a verb right at or near the default start that would be cut off
              const textAroundDefault = text.slice(Math.max(0, defaultContextStart - 20), defaultContextStart + 20);
              const verbNearDefault = cookingVerbs.exec(textAroundDefault);
              
              if (verbNearDefault && verbNearDefault.index !== undefined && verbNearDefault.index < 20) {
                // There's a cooking verb that would be cut off, use the verb position
                contextStart = verbPosition;
              } else if ((defaultContextStart - verbPosition) < 50) {
                // The verb is reasonably close, include it
                // Find the start of the sentence containing this cooking verb
                const beforeVerb = text.slice(Math.max(0, verbPosition - 50), verbPosition);
                const sentenceStart = Math.max(
                  beforeVerb.lastIndexOf('.'),
                  beforeVerb.lastIndexOf('!'),
                  beforeVerb.lastIndexOf('?'),
                  -1
                );
                
                if (sentenceStart >= 0) {
                  // Start from after the sentence boundary
                  contextStart = verbPosition - 50 + sentenceStart + 1;
                  // Skip any whitespace
                  while (contextStart < verbPosition && /\s/.test(text[contextStart])) {
                    contextStart++;
                  }
                } else {
                  // No sentence boundary found, start from the cooking verb
                  contextStart = verbPosition;
                }
              } else {
                contextStart = defaultContextStart;
              }
            } else {
              contextStart = defaultContextStart;
            }
          } else {
            contextStart = defaultContextStart;
          }
          
          // Look forward for the end of the sentence or meaningful phrase
          const searchEnd = Math.min(text.length, matchEnd + 100);
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
      (Math.abs(existingTimer.context.length - timer.context.length) < 10 ||
       Math.abs(existingTimer.contextStart - timer.contextStart) < 20)
    );
  });
  
  // Sort by position in the text (order they appear in instructions)
  return uniqueTimers.sort((a, b) => a.contextStart - b.contextStart);
}

export function detectTimersFromRecipe(
  instructions: string[] = [],
  cookTime?: number,
  recipeId?: string
): DetectedTimer[] {
  // Only detect timers from instructions, not from title or description
  const instructionsText = instructions.join(' ');
  
  const detectedTimers = detectTimersFromText(instructionsText).map(timer => ({
    ...timer,
    id: recipeId ? `${recipeId}-${timer.id}` : timer.id,
  }));
  
  // Add cook time from recipe metadata (but not prep time)
  const metadataTimers: DetectedTimer[] = [];
  
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