export interface TimerCookie {
  id: string;
  endTimestamp: number;
  totalDuration: number; // in seconds
  pausedAt?: number; // timestamp when paused
  pausedRemaining?: number; // remaining time when paused (in seconds)
}

const TIMER_COOKIE_PREFIX = 'timer_';

/**
 * Save a timer's end timestamp to a cookie
 */
export function saveTimerCookie(timerId: string, endTimestamp: number, totalDuration: number): void {
  if (typeof document === 'undefined') return;
  
  const timerData: TimerCookie = {
    id: timerId,
    endTimestamp,
    totalDuration,
  };
  
  const cookieName = `${TIMER_COOKIE_PREFIX}${timerId}`;
  const cookieValue = JSON.stringify(timerData);
  
  // Set cookie to expire 24 hours from now (should be longer than any reasonable timer)
  const expires = new Date();
  expires.setTime(expires.getTime() + (24 * 60 * 60 * 1000));
  
  document.cookie = `${cookieName}=${encodeURIComponent(cookieValue)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

/**
 * Update a timer cookie when paused
 */
export function pauseTimerCookie(timerId: string, pausedAt: number, remainingTime: number): void {
  if (typeof document === 'undefined') return;
  
  const existing = getTimerCookie(timerId);
  if (!existing) return;
  
  const updatedData: TimerCookie = {
    ...existing,
    pausedAt,
    pausedRemaining: remainingTime,
  };
  
  const cookieName = `${TIMER_COOKIE_PREFIX}${timerId}`;
  const cookieValue = JSON.stringify(updatedData);
  
  const expires = new Date();
  expires.setTime(expires.getTime() + (24 * 60 * 60 * 1000));
  
  document.cookie = `${cookieName}=${encodeURIComponent(cookieValue)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

/**
 * Resume a paused timer by updating the end timestamp
 */
export function resumeTimerCookie(timerId: string, newEndTimestamp: number): void {
  if (typeof document === 'undefined') return;
  
  const existing = getTimerCookie(timerId);
  if (!existing) return;
  
  const updatedData: TimerCookie = {
    ...existing,
    endTimestamp: newEndTimestamp,
    pausedAt: undefined,
    pausedRemaining: undefined,
  };
  
  const cookieName = `${TIMER_COOKIE_PREFIX}${timerId}`;
  const cookieValue = JSON.stringify(updatedData);
  
  const expires = new Date();
  expires.setTime(expires.getTime() + (24 * 60 * 60 * 1000));
  
  document.cookie = `${cookieName}=${encodeURIComponent(cookieValue)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

/**
 * Get a timer's data from cookies
 */
export function getTimerCookie(timerId: string): TimerCookie | null {
  if (typeof document === 'undefined') return null;
  
  const cookieName = `${TIMER_COOKIE_PREFIX}${timerId}`;
  const cookies = document.cookie.split(';');
  
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === cookieName && value) {
      try {
        return JSON.parse(decodeURIComponent(value)) as TimerCookie;
      } catch (error) {
        console.error('Failed to parse timer cookie:', error);
        deleteTimerCookie(timerId); // Clean up corrupted cookie
        return null;
      }
    }
  }
  
  return null;
}

/**
 * Delete a timer cookie (when timer ends or is reset)
 */
export function deleteTimerCookie(timerId: string): void {
  if (typeof document === 'undefined') return;
  
  const cookieName = `${TIMER_COOKIE_PREFIX}${timerId}`;
  document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

/**
 * Get all timer cookies
 */
export function getAllTimerCookies(): TimerCookie[] {
  if (typeof document === 'undefined') return [];
  
  const timerCookies: TimerCookie[] = [];
  const cookies = document.cookie.split(';');
  
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name.startsWith(TIMER_COOKIE_PREFIX) && value) {
      try {
        const timerData = JSON.parse(decodeURIComponent(value)) as TimerCookie;
        timerCookies.push(timerData);
      } catch (error) {
        console.error('Failed to parse timer cookie:', error);
        // Clean up corrupted cookie
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
      }
    }
  }
  
  return timerCookies;
}

/**
 * Clean up expired timer cookies
 */
export function cleanupExpiredTimerCookies(): void {
  if (typeof document === 'undefined') return;
  
  const now = Date.now();
  const timerCookies = getAllTimerCookies();
  
  timerCookies.forEach(timerData => {
    // Clean up cookies for timers that have been finished for more than 1 hour
    if (timerData.endTimestamp < now - (60 * 60 * 1000)) {
      deleteTimerCookie(timerData.id);
    }
  });
}

/**
 * Calculate remaining time from end timestamp
 */
export function calculateRemainingTime(endTimestamp: number, isPaused: boolean = false, pausedRemaining?: number): number {
  if (isPaused && pausedRemaining !== undefined) {
    return Math.max(0, pausedRemaining);
  }
  
  const now = Date.now();
  const remaining = Math.max(0, Math.floor((endTimestamp - now) / 1000));
  return remaining;
}