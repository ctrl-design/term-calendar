# Cookie-Based Storage: URLs & Display Settings

## Overview

This feature adds persistent client-side storage using browser cookies for two categories of data:

### Calendar URL Storage
Users can now:
- Save frequently-used calendar URLs for quick access
- See a list of previously-used sources under the "Calendar source" section
- Load a saved URL with a single click
- Remove saved URLs individually

### Display Settings Storage
All display preferences are automatically saved and restored:
- **Week start day** - Your chosen week start (Monday, Tuesday, etc.)
- **Days shown** - Number of days visible per week (1-7)
- **Weeks to show** - Number of weeks in the calendar (1-12)
- **Default event color** - The color used for events without explicit colors

## Implementation Details

### Files Added

1. **[lib/cookies.ts](../../lib/cookies.ts)** - Cookie utility library with URL and settings functions
   - **URL Functions:**
     - `getSavedCalendarUrls()`: Retrieves all saved URLs from cookies
     - `saveCalendarUrl(url)`: Adds/updates a URL (deduplicates, keeps most recent first)
     - `removeCalendarUrl(url)`: Removes a specific URL
     - `clearAllCalendarUrls()`: Clears all saved URLs
   - **Settings Functions:**
     - `getDisplaySettings()`: Retrieves saved display settings
     - `saveDisplaySettings(settings)`: Saves all display settings
     - `clearDisplaySettings()`: Clears all display settings
   - **Type Exports:**
     - `DisplaySettings`: TypeScript type defining the settings structure

### Files Modified

1. **[components/CalendarFormatter.tsx](../../components/CalendarFormatter.tsx)**
   - **State Initialization**: Display settings now load from cookies on component load
   - **useEffect Hooks**:
     - First hook: Loads saved calendar URLs on mount
     - Second hook: Saves display settings whenever any setting changes
   - **Event Handlers**: Added three functions for URL management
   - **New UI Section**: "Saved calendar sources" list under Calendar source heading

2. **[app/globals.css](../../app/globals.css)**
   - Styles for button groups, saved URLs section, and responsive design

### Technical Details

#### Cookie Storage

**Calendar URLs:**
- **Cookie Name**: `calendar_urls`
- **Expiry**: 365 days
- **Format**: JSON-encoded array of URL strings
- **Example**: `["https://example.com/cal.ics", "https://other.com/cal.ics"]`

**Display Settings:**
- **Cookie Name**: `calendar_display_settings`
- **Expiry**: 365 days
- **Format**: JSON-encoded object with 4 properties
- **Example**: 
  ```json
  {
    "weekStartDay": "monday",
    "daysShown": 5,
    "weekCount": 10,
    "defaultEventColor": "#2563eb"
  }
  ```

**Security**: Both cookies use `SameSite=Lax` to prevent CSRF attacks.

#### Display Settings Type Definition

```typescript
type DisplaySettings = {
  weekStartDay: string;    // 'monday', 'tuesday', ..., 'sunday'
  daysShown: number;       // 1-7
  weekCount: number;       // 1-12
  defaultEventColor: string; // hex color like '#2563eb'
};
```

#### Settings Auto-Save Mechanism

When the component mounts:
1. `getDisplaySettings()` checks for saved settings
2. If found, state is initialized with those values
3. If not found, default values are used (5 days, 10 weeks, etc.)

Whenever a setting changes:
1. React re-renders with the new value
2. The `useEffect` dependency array triggers
3. `saveDisplaySettings()` saves the new values to a cookie
4. No user action required - it's completely automatic

#### URL Deduplication Logic

When saving a URL:
1. Parse existing URLs from cookie
2. Remove any duplicate of the new URL
3. Add the new URL to the front of the array (most recent first)
4. Store updated array in cookie

This ensures:
- No duplicate URLs
- Recently-used URLs appear first
- User can quickly find their most-used calendars

#### Browser Compatibility

- Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- Gracefully degrades in SSR contexts (checks for `typeof document`)
- Uses standard `document.cookie` API with no external dependencies

## User Interface

### Display Settings (Auto-Saved)
All four display settings have automatic persistence:

**Term start date**: Not persisted (intentionally left blank each session)

**Week start day**: 
- Dropdown selector
- Current choice automatically saved
- Restored when page reloads

**Days shown** & **Weeks to show**:
- Number input fields
- Values saved automatically after each change
- Restored when page reloads

**Default event color**:
- Color picker
- Selected color saved automatically
- Restored when page reloads

### Calendar URL Management

**"Save this URL" Button:**
Located next to "Load calendar URL" button. Saves the current URL input field value to the browser cookie for later reuse.

**"Saved calendar sources" Section:**
Appears below the save button only if there are saved URLs. Shows:
- **URL Link**: Displays the hostname of the saved URL (truncated with ellipsis if long)
- **Remove Button (✕)**: Deletes that URL from saved list
- **Hover Behavior**: Shows full URL in tooltip, link highlights on hover

When a saved URL is clicked:
1. URL input field is populated with that URL
2. User can then click "Load calendar URL" to fetch and parse the calendar

## Usage Examples

### Example 1: First-Time Setup
1. User enters a calendar URL: `https://example.com/calendar.ics`
2. User adjusts settings (e.g., "Days shown" to 7, "Week start day" to Sunday)
3. User clicks "Load calendar URL"
4. Settings are automatically saved to cookies
5. User clicks "Save this URL"
6. On next visit, all settings and saved URL are restored automatically

### Example 2: Quick Reload with Remembered Settings
1. User returns to the page after closing it
2. All display settings are restored (7 days shown, Sunday start, etc.)
3. Saved calendar URLs appear under "Saved calendar sources"
4. User clicks saved URL to populate the input field
5. Clicks "Load calendar URL" to fetch

### Example 3: Adjust Settings Mid-Session
1. User changes "Weeks to show" from 10 to 12
2. Calendar grid immediately redraws
3. New value is automatically saved to cookie
4. When page reloads later, the 12-week setting is remembered

### Example 4: Clean Up Stale Sources
1. User sees an old calendar source in the saved list
2. Clicks the ✕ button next to it
3. URL is removed from saved list
4. Cookie is updated; list no longer shows that URL

## State Management

The component maintains:
```typescript
const [daysShown, setDaysShown] = useState<number>(...);
const [weekStartDay, setWeekStartDay] = useState<string>(...);
const [weekCount, setWeekCount] = useState<number>(...);
const [defaultEventColor, setDefaultEventColor] = useState<string>(...);
const [savedUrls, setSavedUrls] = useState<string[]>([]);
```

### Initialization Flow
1. `getDisplaySettings()` retrieves saved values (or null)
2. State uses saved values if available, otherwise defaults
3. `useEffect` hook saves to cookies when values change

### Event Handlers for URLs
- `handleSaveUrl()`: Saves URL input to cookies
- `handleLoadSavedUrl(url)`: Populates URL field with saved URL
- `handleRemoveSavedUrl(url)`: Removes URL from saved list

## Performance Considerations

- **Minimal overhead**: Cookie operations only execute on mount and when user explicitly saves/removes/changes settings
- **Deferred loading**: Saved URLs and settings only load on initial mount (not on every interaction)
- **No network requests**: All storage operations are local
- **Auto-save**: Display settings saved on every change (debounce could be added if performance becomes an issue)

## Privacy & Security

- **Client-side only**: No data sent to server
- **Plaintext storage**: URLs stored in plaintext (standard for browser cookies)
- **Each device separate**: Each browser/device maintains its own list
- **User clearable**: Users can clear saved URLs anytime by clearing browser cookies
- **Site-specific**: Different domains/sites have separate cookie namespaces
- **CSRF protection**: Uses `SameSite=Lax` attribute

## Cookie Size Limits

**Typical Size Estimates:**
- One calendar URL: ~50 bytes
- Display settings: ~100 bytes
- 10 saved URLs + settings: ~600 bytes (well under 4KB limit per cookie)

Modern browsers allow up to 4KB per cookie, so there's plenty of room for dozens of saved URLs.

## Advanced: Clear Everything

Users can clear both saved URLs and display settings via browser DevTools:
```javascript
// In browser console:
document.cookie = 'calendar_urls=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
document.cookie = 'calendar_display_settings=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
```

Or by clearing browser cookies for the site.

## Testing

Test file: [__tests__/cookies.test.ts](__tests__/cookies.test.ts)

**URL Storage Tests:**
- Retrieving empty list when no cookies exist
- Saving and retrieving a single URL
- Deduplication (most recent first)
- Removing specific URLs
- Clearing all URLs
- Ignoring empty/whitespace URLs

**Settings Storage Tests:**
- Retrieving null when no settings saved
- Saving and retrieving settings object
- Overwriting previous settings
- Field type preservation
- Clearing all settings

## Future Enhancements

Potential improvements:
1. **Export/Import** - Allow users to export/import their saved URL list and settings
2. **Labels** - Let users add custom labels to URLs instead of just showing hostname
3. **Local Storage** - Switch to `localStorage` for larger capacity (~5-10MB vs 4KB)
4. **Sync** - Cloud-based sync of settings and URLs across devices/browsers
5. **Categories** - Organize saved URLs into folders/groups
6. **Debouncing** - Debounce settings saves to reduce cookie writes
7. **Presets** - Save/load complete display setting presets
