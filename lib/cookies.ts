/**
 * Cookie utilities for storing and retrieving calendar URLs and display settings
 */

const CALENDAR_URLS_COOKIE = 'calendar_urls';
const DISPLAY_SETTINGS_COOKIE = 'calendar_display_settings';
const COOKIE_EXPIRY_DAYS = 365; // Store for 1 year

export type CalendarSource = {
  url: string;
  nickname?: string;
};

export type DisplaySettings = {
  weekStartDay: string;
  daysShown: number;
  weekCount: number;
  defaultEventColor: string;
};

/**
 * Get all saved calendar sources from cookies
 * Handles both legacy string array format and new object format
 */
export function getSavedCalendarUrls(): CalendarSource[] {
  if (typeof document === 'undefined') {
    return [];
  }

  try {
    const cookie = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${CALENDAR_URLS_COOKIE}=`))
      ?.split('=')[1];

    if (!cookie) {
      return [];
    }

    const parsed = JSON.parse(decodeURIComponent(cookie));
    
    // Handle legacy format (array of strings) and convert to new format
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (typeof parsed[0] === 'string') {
        return parsed.map((url: string) => ({ url, nickname: undefined }));
      }
    }
    
    return parsed || [];
  } catch {
    return [];
  }
}

/**
 * Save a calendar URL to cookies (deduplicates, keeps most recent first)
 */
export function saveCalendarUrl(url: string, nickname?: string): CalendarSource[] {
  const sources = getSavedCalendarUrls();
  const normalizedUrl = url.trim();

  if (!normalizedUrl) {
    return sources;
  }

  // Remove if already exists, then add to front
  const filtered = sources.filter((s) => s.url !== normalizedUrl);
  const updated = [{ url: normalizedUrl, nickname }, ...filtered];

  // Store in cookie
  const expires = new Date();
  expires.setDate(expires.getDate() + COOKIE_EXPIRY_DAYS);

  document.cookie = `${CALENDAR_URLS_COOKIE}=${encodeURIComponent(JSON.stringify(updated))}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;

  return updated;
}

/**
 * Update the nickname for a saved calendar URL
 */
export function updateCalendarNickname(url: string, nickname: string): CalendarSource[] {
  const sources = getSavedCalendarUrls();
  const updated = sources.map((s) => (s.url === url ? { ...s, nickname: nickname || undefined } : s));

  const expires = new Date();
  expires.setDate(expires.getDate() + COOKIE_EXPIRY_DAYS);

  document.cookie = `${CALENDAR_URLS_COOKIE}=${encodeURIComponent(JSON.stringify(updated))}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;

  return updated;
}

/**
 * Remove a calendar URL from cookies
 */
export function removeCalendarUrl(url: string): CalendarSource[] {
  const sources = getSavedCalendarUrls();
  const updated = sources.filter((s) => s.url !== url);

  if (updated.length === 0) {
    // Delete the cookie if no URLs remain
    document.cookie = `${CALENDAR_URLS_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
  } else {
    const expires = new Date();
    expires.setDate(expires.getDate() + COOKIE_EXPIRY_DAYS);
    document.cookie = `${CALENDAR_URLS_COOKIE}=${encodeURIComponent(JSON.stringify(updated))}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  }

  return updated;
}

/**
 * Clear all saved calendar URLs
 */
export function clearAllCalendarUrls(): void {
  document.cookie = `${CALENDAR_URLS_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

/**
 * Get display settings from cookies
 */
export function getDisplaySettings(): DisplaySettings | null {
  if (typeof document === 'undefined') {
    return null;
  }

  try {
    const cookie = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${DISPLAY_SETTINGS_COOKIE}=`))
      ?.split('=')[1];

    if (!cookie) {
      return null;
    }

    return JSON.parse(decodeURIComponent(cookie));
  } catch {
    return null;
  }
}

/**
 * Save display settings to cookies
 */
export function saveDisplaySettings(settings: DisplaySettings): void {
  if (typeof document === 'undefined') {
    return;
  }

  try {
    const expires = new Date();
    expires.setDate(expires.getDate() + COOKIE_EXPIRY_DAYS);

    document.cookie = `${DISPLAY_SETTINGS_COOKIE}=${encodeURIComponent(JSON.stringify(settings))}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  } catch {
    // Silently fail if unable to save
  }
}

/**
 * Clear display settings from cookies
 */
export function clearDisplaySettings(): void {
  document.cookie = `${DISPLAY_SETTINGS_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}
