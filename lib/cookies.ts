/**
 * Cookie utilities for storing and retrieving calendar URLs and display settings
 */

const CALENDAR_URLS_COOKIE = 'calendar_urls';
const DISPLAY_SETTINGS_COOKIE = 'calendar_display_settings';
const COOKIE_EXPIRY_DAYS = 365; // Store for 1 year

export type DisplaySettings = {
  weekStartDay: string;
  daysShown: number;
  weekCount: number;
  defaultEventColor: string;
};

/**
 * Get all saved calendar URLs from cookies
 */
export function getSavedCalendarUrls(): string[] {
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

    return JSON.parse(decodeURIComponent(cookie));
  } catch {
    return [];
  }
}

/**
 * Save a calendar URL to cookies (deduplicates, keeps most recent first)
 */
export function saveCalendarUrl(url: string): string[] {
  const urls = getSavedCalendarUrls();
  const normalizedUrl = url.trim();

  if (!normalizedUrl) {
    return urls;
  }

  // Remove if already exists, then add to front
  const filtered = urls.filter((u) => u !== normalizedUrl);
  const updated = [normalizedUrl, ...filtered];

  // Store in cookie
  const expires = new Date();
  expires.setDate(expires.getDate() + COOKIE_EXPIRY_DAYS);

  document.cookie = `${CALENDAR_URLS_COOKIE}=${encodeURIComponent(JSON.stringify(updated))}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;

  return updated;
}

/**
 * Remove a calendar URL from cookies
 */
export function removeCalendarUrl(url: string): string[] {
  const urls = getSavedCalendarUrls();
  const updated = urls.filter((u) => u !== url);

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
