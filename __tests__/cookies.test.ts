/**
 * Test file to verify cookie functionality
 * These tests can be run in a Node environment or in the browser console
 */

import { getSavedCalendarUrls, saveCalendarUrl, removeCalendarUrl, clearAllCalendarUrls, getDisplaySettings, saveDisplaySettings, clearDisplaySettings } from '../lib/cookies';

// Mock document.cookie for Node.js testing
if (typeof document === 'undefined') {
  (global as any).document = {
    cookie: '',
  };
}

describe('Cookie utilities', () => {
  beforeEach(() => {
    // Clear cookies before each test
    if (typeof document !== 'undefined') {
      document.cookie = 'calendar_urls=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
      document.cookie = 'calendar_display_settings=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
    }
  });

  describe('URL Storage', () => {
    test('getSavedCalendarUrls returns empty array when no cookies exist', () => {
      const urls = getSavedCalendarUrls();
      expect(urls).toEqual([]);
    });

    test('saveCalendarUrl saves a URL and retrieves it', () => {
      const testUrl = 'https://example.com/calendar.ics';
      const result = saveCalendarUrl(testUrl);
      expect(result).toContain(testUrl);
      expect(getSavedCalendarUrls()).toContain(testUrl);
    });

    test('saveCalendarUrl deduplicates URLs (most recent first)', () => {
      const url1 = 'https://example1.com/calendar.ics';
      const url2 = 'https://example2.com/calendar.ics';

      saveCalendarUrl(url1);
      saveCalendarUrl(url2);
      let urls = getSavedCalendarUrls();

      expect(urls[0]).toBe(url2); // Most recent first
      expect(urls[1]).toBe(url1);

      // Saving url1 again should move it to front
      saveCalendarUrl(url1);
      urls = getSavedCalendarUrls();

      expect(urls[0]).toBe(url1); // Now it's first
      expect(urls[1]).toBe(url2);
    });

    test('removeCalendarUrl removes a specific URL', () => {
      const url1 = 'https://example1.com/calendar.ics';
      const url2 = 'https://example2.com/calendar.ics';

      saveCalendarUrl(url1);
      saveCalendarUrl(url2);

      const result = removeCalendarUrl(url1);

      expect(result).toContain(url2);
      expect(result).not.toContain(url1);
      expect(getSavedCalendarUrls()).not.toContain(url1);
    });

    test('removeCalendarUrl clears the cookie when last URL is removed', () => {
      const url = 'https://example.com/calendar.ics';
      saveCalendarUrl(url);
      expect(getSavedCalendarUrls()).toContain(url);

      removeCalendarUrl(url);
      expect(getSavedCalendarUrls()).toEqual([]);
    });

    test('clearAllCalendarUrls removes all URLs', () => {
      saveCalendarUrl('https://example1.com/calendar.ics');
      saveCalendarUrl('https://example2.com/calendar.ics');

      clearAllCalendarUrls();

      expect(getSavedCalendarUrls()).toEqual([]);
    });

    test('saveCalendarUrl ignores empty/whitespace-only URLs', () => {
      const urls = saveCalendarUrl('   ');
      expect(urls).toEqual([]);
    });
  });

  describe('Display Settings Storage', () => {
    test('getDisplaySettings returns null when no settings are saved', () => {
      const settings = getDisplaySettings();
      expect(settings).toBeNull();
    });

    test('saveDisplaySettings saves and retrieves settings', () => {
      const testSettings = {
        weekStartDay: 'monday',
        daysShown: 5,
        weekCount: 10,
        defaultEventColor: '#2563eb',
      };

      saveDisplaySettings(testSettings);
      const retrieved = getDisplaySettings();

      expect(retrieved).toEqual(testSettings);
    });

    test('saveDisplaySettings overwrites previous settings', () => {
      const settings1 = {
        weekStartDay: 'monday',
        daysShown: 5,
        weekCount: 10,
        defaultEventColor: '#2563eb',
      };

      const settings2 = {
        weekStartDay: 'friday',
        daysShown: 7,
        weekCount: 12,
        defaultEventColor: '#ff0000',
      };

      saveDisplaySettings(settings1);
      expect(getDisplaySettings()).toEqual(settings1);

      saveDisplaySettings(settings2);
      expect(getDisplaySettings()).toEqual(settings2);
    });

    test('saveDisplaySettings preserves all field types', () => {
      const testSettings = {
        weekStartDay: 'wednesday',
        daysShown: 3,
        weekCount: 8,
        defaultEventColor: '#00ff00',
      };

      saveDisplaySettings(testSettings);
      const retrieved = getDisplaySettings();

      expect(typeof retrieved?.weekStartDay).toBe('string');
      expect(typeof retrieved?.daysShown).toBe('number');
      expect(typeof retrieved?.weekCount).toBe('number');
      expect(typeof retrieved?.defaultEventColor).toBe('string');
    });

    test('clearDisplaySettings removes saved settings', () => {
      const testSettings = {
        weekStartDay: 'monday',
        daysShown: 5,
        weekCount: 10,
        defaultEventColor: '#2563eb',
      };

      saveDisplaySettings(testSettings);
      expect(getDisplaySettings()).toEqual(testSettings);

      clearDisplaySettings();
      expect(getDisplaySettings()).toBeNull();
    });
  });
});
