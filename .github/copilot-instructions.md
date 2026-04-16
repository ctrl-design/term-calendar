---
name: copilot-instructions
description: Workspace-level instructions for the term-calendar project
---

# Term Calendar Workspace Instructions

## Project Overview

**term-calendar** is a Next.js web application that converts iCal/Google Calendar feeds into a configurable week-based "term view" display—ideal for academic term planning with numbered weeks and event tiles.

**Key Stack**: Next.js 16.2.3 + React 19 + TypeScript 5.6 + ical.js 2.2 (for iCal parsing). Client-side rendering with vanilla CSS (flexbox, responsive grid). Vercel Analytics integrated.

See [README.md](../../README.md) for user-facing overview.

## Development Workflow

### Getting Started
```bash
npm install
npm run dev          # localhost:3000 with hot reload
npm run build        # Production build
npm start            # Run production bundle
npm run lint         # ESLint check
```

**No environment variables needed.** Calendar data is user-provided at runtime (URL, file upload, or paste).

### Key Files & Architecture

- **[app/page.tsx](../../app/page.tsx)**: Home page, renders CalendarFormatter
- **[components/CalendarFormatter.tsx](../../components/CalendarFormatter.tsx)**: Main UI/logic hub
  - State management (events, display settings)
  - Input handling (URL fetch, file upload, text paste)
  - Calendar grid generation (memoized for perf)
  - Event filtering & recurring expansion
- **[app/api/fetch-ics/route.ts](../../app/api/fetch-ics/route.ts)**: POST endpoint for CORS-safe iCal URL fetching
  - Accepts `{ url: string }`, returns raw .ics content
  - Handles various calendar server responses with broad headers
- **[app/globals.css](../../app/globals.css)**: Responsive grid layout, radial gradients, color scheme
- **[types/ical-js.d.ts](../../types/ical-js.d.ts)**: Type definitions for ical.js library

## Code Conventions

### Type System
- **`EventSpec`**: Parsed calendar event (start, end, title, color, description, etc.)
- **`CalendarRow`**: Week number + 5 day columns with events

### Date Handling
- All dates normalized to midnight (00:00:00) for day-only comparisons
- Helper functions: `addDays()`, `normalizeDate()`, `getWeekStart()`
- iCal.js flag `event.startDate.isDate` identifies all-day events (not time values)

### Performance Patterns
- **`useMemo`** used heavily for row generation, event filtering, recurring expansion
- Recurring event expansion only spans visible date range (no unnecessary computation)
- Hard-coded 500-iteration limit in `getRecurringOccurrences()` prevents memory bloat

### Color Handling
- iCal color extraction priority: `color` → `x-apple-calendar-color` → `x-google-calendar-color` → `x-microsoft-categories`
- Text contrast computed from background hex via brightness formula: `(R×299 + G×587 + B×114) / 1000`
- Light/dark text choices ensure readability

## Common Development Gotchas

### CORS Issues
- **Google Calendar public URLs** often fail CORS from browser; users must export raw `.ics` file instead of sharing calendar link directly
- The `/api/fetch-ics` endpoint solves this for URL-based loading

### Recurring Event Limits
- Hard-coded 500-iteration limit prevents UI hangs on infinitely-recurring series
- Consider this when testing with events like "every weekday forever"

### All-Day Event Detection
- Relies on `event.startDate.isDate` property from ical.js
- Malformed iCal may not detect correctly; validate edge cases

### Timezone Handling
- ical.js manages timezone-aware vs naive dates
- JSON serialization can cause unexpected timezone shifts—be careful with Date conversions

### File Upload Encoding
- Assumes UTF-8 encoding; non-UTF8 files fail silently
- Consider warning users or adding encoding detection if needed

## When Modifying

- **CalendarFormatter logic**: Focus on state management, memoization, and event filtering efficiency
- **Styling**: Use CSS Grid + Flexbox patterns; maintain responsive behavior (max-width 1200px)
- **iCal parsing**: Test with samples from Google Calendar, Apple Calendar, Outlook exports
- **API endpoint**: Validate CORS headers and error responses (400, 502, 500)

## Testing & Quality

- **ESLint** runs via `npm run lint`
- **TypeScript** strict mode enabled (check [tsconfig.json](../../tsconfig.json))
- **React strict mode** enabled (double-mount in dev to catch side effects)

Consider adding manual tests for:
- Recurring event expansion (with cycle limits)
- All-day vs timed event rendering
- Color contrast readability on various backgrounds
- CORS proxy error handling

## Links

- [ical.js Documentation](https://github.com/mozilla-comm/ical.js)
- [Next.js App Router](https://nextjs.org/docs/app)
- [React 19 Hooks API](https://react.dev/reference/react)
