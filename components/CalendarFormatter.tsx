'use client';

import { useMemo, useState, useEffect, type ChangeEvent } from 'react';
import ICAL from 'ical.js';
import { getSavedCalendarUrls, saveCalendarUrl, removeCalendarUrl, updateCalendarNickname, getDisplaySettings, saveDisplaySettings, type CalendarSource } from '../lib/cookies';

type EventSpec = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  color?: string;
  htmlDescription?: string;
  allDay: boolean;
  start: Date;
  end: Date;
  isRecurring: boolean;
  eventObject: any;
};

// Note: CalendarRow type is used in the generated rows object
type CalendarRow = {
  weekNumber: number;
  days: Date[];
};

const WEEK_START_OPTIONS = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

const WEEK_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeDate(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function getWeekStart(date: Date, weekStart: string) {
  const target = WEEK_LABELS.findIndex((label) => label.toLowerCase() === weekStart.toLowerCase());
  if (target < 0) return normalizeDate(date);

  const current = date.getDay();
  const shift = (current - target + 7) % 7;
  return normalizeDate(addDays(date, -shift));
}

function formatCellDate(date: Date) {
  return `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

function formatTimeLabel(event: EventSpec) {
  if (event.allDay) {
    return 'All day';
  }

  const startLabel = event.start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const endLabel = event.end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${startLabel}\n${endLabel}`;
}

function computeTextColor(background: string) {
  if (!background?.startsWith('#')) {
    return '#ffffff';
  }
  const hex = background.replace('#', '');
  const normalized = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#111111' : '#ffffff';
}

function eventOverlapsDay(event: EventSpec, day: Date) {
  const startOfDay = normalizeDate(day);
  const endOfDay = addDays(startOfDay, 1);
  return event.start < endOfDay && event.end > startOfDay;
}

function parseIcs(text: string): { events: EventSpec[], calendarName: string | null } {
  const raw = ICAL.parse(text);
  const root = new ICAL.Component(raw);
  const vevents = root.getAllSubcomponents('vevent');

  // Extract calendar name from VCALENDAR component
  let calendarName: string | null = null;
  try {
    // Try common calendar name properties
    calendarName = 
      root.getFirstPropertyValue('x-wr-calname') ||
      root.getFirstPropertyValue('calscale') ||
      null;
    
    // If no calendar name found, try to use prodid or name
    if (!calendarName) {
      const prodid = root.getFirstPropertyValue('prodid');
      if (prodid && typeof prodid === 'string') {
        // Extract clean name from prodid (e.g., "-//Google Inc//Google Calendar//EN" -> "Google Calendar")
        const match = prodid.match(/\/\/([^/]+)\/\//);  // eslint-disable-line no-useless-escape
        if (match && match[1]) {
          calendarName = match[1];
        }
      }
    }
  } catch {
    // Silently fail to extract calendar name
  }

  // Helper to safely convert ICAL.Time to JS Date, preserving time component
  const toDatePreservingTime = (time: any): Date => {
    if (!time) return new Date();

    try {
      // If this is an ICAL.Time object with time components, use them directly
      // This preserves the intended local time without timezone conversion issues
      if (time._time) {
        const t = time._time;
        const year = t.year;
        const month = t.month - 1; // JS months are 0-indexed
        const day = t.day;
        const hour = t.hour || 0;
        const minute = t.minute || 0;
        const second = t.second || 0;
        return new Date(year, month, day, hour, minute, second);
      }
    } catch {
      // Fall back if direct component access fails
    }

    // Fall back to toJSDate for non-ICAL.Time objects
    return time.toJSDate?.() ?? new Date();
  };

  const events = vevents.map((component: any, index: number) => {
    const event = new ICAL.Event(component);

    const color =
      component.getFirstPropertyValue('color') ||
      component.getFirstPropertyValue('x-apple-calendar-color') ||
      component.getFirstPropertyValue('x-google-calendar-color') ||
      component.getFirstPropertyValue('x-microsoft-categories');

    const startDate = toDatePreservingTime(event.startDate);
    const endDate = toDatePreservingTime(event.endDate);

    return {
      id: event.uid || `ev-${index}-${startDate.getTime()}`,
      summary: event.summary || 'Untitled event',
      description: event.description,
      location: event.location,
      color: typeof color === 'string' ? color : undefined,
      htmlDescription: component.getFirstPropertyValue('x-alt-desc'),
      allDay: event.startDate?.isDate ?? false,
      start: startDate,
      end: endDate,
      isRecurring: Boolean(event.isRecurring && event.isRecurring()),
      eventObject: event,
    };
  });

  return { events, calendarName };
}


function getRecurringOccurrences(eventSpec: EventSpec, rangeStart: Date, rangeEnd: Date) {
  if (!eventSpec.isRecurring || typeof eventSpec.eventObject.iterator !== 'function') {
    return [];
  }

  // Helper to safely convert ICAL.Time to JS Date, preserving time component
  const toDatePreservingTime = (time: any): Date => {
    if (!time) return new Date();

    try {
      // If this is an ICAL.Time object with time components, use them directly
      if (time._time) {
        const t = time._time;
        const year = t.year;
        const month = t.month - 1; // JS months are 0-indexed
        const day = t.day;
        const hour = t.hour || 0;
        const minute = t.minute || 0;
        const second = t.second || 0;
        return new Date(year, month, day, hour, minute, second);
      }
    } catch {
      // Fall back if direct component access fails
    }

    return time.toJSDate?.() ?? new Date();
  };

  const occurrences: EventSpec[] = [];
  const duration = eventSpec.end.getTime() - eventSpec.start.getTime();
  const iterator = eventSpec.eventObject.iterator(ICAL.Time.fromJSDate(rangeStart, true));

  for (let i = 0; i < 500; i += 1) {
    const next = iterator.next();
    if (!next) break;

    const start = toDatePreservingTime(next);
    if (start >= rangeEnd) break;

    const end = new Date(start.getTime() + duration);
    if (end <= rangeStart) {
      continue;
    }

    occurrences.push({
      ...eventSpec,
      start,
      end,
      id: `${eventSpec.id}-${start.toISOString()}`,
    });
  }

  return occurrences;
}

function getVisibleOccurrences(events: EventSpec[], rangeStart: Date, rangeEnd: Date) {
  return events.flatMap((event) => {
    if (!event.isRecurring) {
      return event.end > rangeStart && event.start < rangeEnd ? [event] : [];
    }
    return getRecurringOccurrences(event, rangeStart, rangeEnd);
  });
}

export default function CalendarFormatter() {
  // Initialize state with saved settings or defaults
  const [daysShown, setDaysShown] = useState(() => getDisplaySettings()?.daysShown ?? 5);
  const [weekStartDay, setWeekStartDay] = useState(() => getDisplaySettings()?.weekStartDay ?? 'monday');
  const [weekCount, setWeekCount] = useState(() => getDisplaySettings()?.weekCount ?? 10);
  const [defaultEventColor, setDefaultEventColor] = useState(() => getDisplaySettings()?.defaultEventColor ?? '#2563eb');

  const [calendarUrl, setCalendarUrl] = useState('');
  const [icsText, setIcsText] = useState('');
  const [events, setEvents] = useState<EventSpec[]>([]);
  const [termStart, setTermStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [controlsOpen, setControlsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sourceLabel, setSourceLabel] = useState('No calendar loaded yet.');
  const [savedUrls, setSavedUrls] = useState<CalendarSource[]>([]);
  const [editingUrl, setEditingUrl] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState('');

  // Load saved URLs from cookies on mount
  useEffect(() => {
    setSavedUrls(getSavedCalendarUrls());
  }, []);

  // Save display settings to cookies whenever they change
  useEffect(() => {
    saveDisplaySettings({
      daysShown,
      weekStartDay,
      weekCount,
      defaultEventColor,
    });
  }, [daysShown, weekStartDay, weekCount, defaultEventColor]);

  const rows = useMemo((): CalendarRow[] => {
    const termDate = normalizeDate(new Date(termStart));
    const gridStart = getWeekStart(termDate, weekStartDay);

    return Array.from({ length: weekCount }, (_, rowIndex) => {
      const rowStart = addDays(gridStart, rowIndex * 7);
      return {
        weekNumber: rowIndex + 1,
        days: Array.from({ length: daysShown }, (_, dayIndex) => addDays(rowStart, dayIndex)),
      };
    });
  }, [termStart, daysShown, weekStartDay, weekCount]);

  const visibleRange = useMemo(() => {
    if (!rows.length) {
      return { start: new Date(), end: new Date() };
    }
    const firstDay = rows[0].days[0];
    const lastDay = rows[rows.length - 1].days[rows[0].days.length - 1];
    return { start: firstDay, end: addDays(lastDay, 1) };
  }, [rows]);

  const occurrences = useMemo(
    () => getVisibleOccurrences(events, visibleRange.start, visibleRange.end),
    [events, visibleRange.start, visibleRange.end],
  );

  const loadIcsFromText = (text: string, source = 'manual input') => {
    setError('');
    try {
      const { events, calendarName } = parseIcs(text);
      if (!events.length) {
        setError('No VEVENT items were found in the calendar file.');
        return;
      }
      setEvents(events);
      setSourceLabel(`Loaded from ${source}. ${events.length} event${events.length === 1 ? '' : 's'} parsed.`);

      // Auto-set nickname if calendar was loaded from a URL and has no nickname
      if (calendarName && calendarUrl.trim()) {
        const normalizedUrl = calendarUrl.trim();
        const source = savedUrls.find((s) => s.url === normalizedUrl);
        if (source && !source.nickname) {
          const updated = updateCalendarNickname(normalizedUrl, calendarName);
          setSavedUrls(updated);
        }
      }
    } catch (err) {
      setError((err as Error).message || 'Unable to parse the iCal data.');
    }
  };

  const handleUrlLoad = async () => {
    if (!calendarUrl.trim()) {
      setError('Please enter an iCal URL.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/fetch-ics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: calendarUrl.trim() }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to fetch calendar URL (${response.status}).`);
      }

      if (typeof result.data !== 'string') {
        throw new Error('Invalid calendar response from proxy.');
      }

      loadIcsFromText(result.data, 'URL');
    } catch (err) {
      setError(
        (err as Error).message ||
          'Unable to load the URL via proxy. If this is a private Google Calendar URL, paste the raw .ics content instead.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setLoading(true);
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        loadIcsFromText(reader.result, file.name);
      }
      setLoading(false);
    };
    reader.onerror = () => {
      setError('Unable to read the selected file.');
      setLoading(false);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleSaveUrl = () => {
    if (!calendarUrl.trim()) {
      setError('Please enter a URL to save.');
      return;
    }
    const updated = saveCalendarUrl(calendarUrl.trim());
    setSavedUrls(updated);
  };

  const handleLoadSavedUrl = (source: CalendarSource) => {
    setCalendarUrl(source.url);
  };

  const handleRemoveSavedUrl = (url: string) => {
    const updated = removeCalendarUrl(url);
    setSavedUrls(updated);
    setEditingUrl(null);
  };

  const handleStartEditingNickname = (source: CalendarSource) => {
    setEditingUrl(source.url);
    setEditingNickname(source.nickname || '');
  };

  const handleSaveNickname = (url: string) => {
    const updated = updateCalendarNickname(url, editingNickname);
    setSavedUrls(updated);
    setEditingUrl(null);
    setEditingNickname('');
  };

  return (
    <div className="calendar-builder">
      <details
        className="controls-panel"
        open={controlsOpen}
        onToggle={(event) => setControlsOpen(event.currentTarget.open)}
      >
        <summary className="controls-summary">Calendar settings</summary>
        <div className="builder-grid">
          <section className="panel">
            <h2>Display settings</h2>
          <div className="field-group">
            <label htmlFor="termStart">Term start date</label>
            <input
              id="termStart"
              type="date"
              value={termStart}
              onChange={(event) => setTermStart(event.target.value)}
            />
          </div>

          <div className="field-group">
            <label htmlFor="weekStartDay">Week start day</label>
            <select
              id="weekStartDay"
              value={weekStartDay}
              onChange={(event) => setWeekStartDay(event.target.value)}
            >
              {WEEK_START_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field-grid">
            <div className="field-group">
              <label htmlFor="daysShown">Days shown</label>
              <input
                id="daysShown"
                type="number"
                min={1}
                max={7}
                value={daysShown}
                onChange={(event) => setDaysShown(Number(event.target.value))}
              />
            </div>
            <div className="field-group">
              <label htmlFor="weekCount">Weeks to show</label>
              <input
                id="weekCount"
                type="number"
                min={1}
                max={12}
                value={weekCount}
                onChange={(event) => setWeekCount(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="defaultEventColor">Default event colour</label>
            <input
              id="defaultEventColor"
              type="color"
              value={defaultEventColor}
              onChange={(event) => setDefaultEventColor(event.target.value)}
            />
          </div>

          <div className="status-panel">
            <p>{sourceLabel}</p>
            <p>{events.length ? `${events.length} calendar event definitions loaded.` : 'No calendar events loaded yet.'}</p>
          </div>
        </section>

        <section className="panel">
          <h2>Calendar source</h2>
          <div className="field-group">
            <label htmlFor="calendarUrl">iCal URL</label>
            <input
              id="calendarUrl"
              type="url"
              placeholder="https://.../calendar.ics"
              value={calendarUrl}
              onChange={(event) => setCalendarUrl(event.target.value)}
            />
          </div>
          <div className="button-group">
            <button type="button" className="action-button" onClick={handleUrlLoad} disabled={loading}>
              {loading ? 'Loading...' : 'Load calendar URL'}
            </button>
            <button type="button" className="action-button secondary" onClick={handleSaveUrl}>
              Save this URL
            </button>
          </div>

          {savedUrls.length > 0 && (
            <div className="saved-urls-section">
              <h3>Saved calendar sources</h3>
              <ul className="saved-urls-list">
                {savedUrls.map((source) => (
                  <li key={source.url} className="saved-url-item">
                    <div className="saved-url-content">
                      {editingUrl === source.url ? (
                        <input
                          type="text"
                          value={editingNickname}
                          onChange={(e) => setEditingNickname(e.target.value)}
                          placeholder="Enter nickname (optional)"
                          className="saved-url-link nickname-input"
                        />
                      ) : (
                        <button
                          type="button"
                          className="saved-url-link"
                          onClick={() => handleLoadSavedUrl(source)}
                          title={source.url}
                        >
                          {source.nickname || new URL(source.url).hostname || 'Unnamed source'}
                        </button>
                      )}
                      {editingUrl === source.url ? (
                        <>
                          <button
                            type="button"
                            className="save-button"
                            onClick={() => handleSaveNickname(source.url)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="cancel-button"
                            onClick={() => {
                              setEditingUrl(null);
                              setEditingNickname('');
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="edit-button"
                            onClick={() => handleStartEditingNickname(source)}
                            title="Edit nickname"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="remove-button"
                            onClick={() => handleRemoveSavedUrl(source.url)}
                            title="Remove this URL"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="divider" />

          <div className="field-group">
            <label htmlFor="icsText">Paste iCal content</label>
            <textarea
              id="icsText"
              rows={10}
              value={icsText}
              onChange={(event) => setIcsText(event.target.value)}
              placeholder="Paste raw .ics content here"
            />
          </div>
          <button
            type="button"
            className="action-button"
            onClick={() => loadIcsFromText(icsText, 'paste')}
            disabled={loading}
          >
            Parse pasted iCal
          </button>

          <div className="divider" />

          <div className="field-group">
            <label htmlFor="fileUpload">Upload .ics file</label>
            <input id="fileUpload" type="file" accept=".ics" onChange={handleFileUpload} />
          </div>

          <p className="hint">
            The app now proxies the iCal URL through the server to avoid browser CORS issues.
            If a private Google Calendar URL still fails, paste the raw .ics content or upload the file instead.
          </p>
        </section>
      </div>
      </details>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="calendar-frame">
        <table className="calendar-table">
          <thead>
            <tr>
              <th>Week</th>
              {rows[0]?.days.map((day) => (
                <th key={day.toISOString()}>{day.toLocaleDateString(undefined, { weekday: 'short' })}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.weekNumber}>
                <th className="week-number">{row.weekNumber}</th>
                {row.days.map((day) => {
                  const dayEvents = occurrences
                    .filter((event) => eventOverlapsDay(event, day))
                    .sort((a, b) => a.start.getTime() - b.start.getTime());

                  return (
                    <td key={day.toISOString()} className={day < new Date(termStart) ? 'before-term' : ''}>
                      <div className="date-pill">{formatCellDate(day)}</div>
                      {dayEvents.length ? (
                        <div className="event-list">
                          {dayEvents.map((event) => {
                            const background = event.color || defaultEventColor;
                            const textColor = computeTextColor(background);
                            return (
                              <div
                                key={event.id}
                                className="event-chip"
                                style={{ backgroundColor: background, color: textColor }}
                              >
                                <div className="event-time">{formatTimeLabel(event)}</div>
                                <div className="event-title">{event.summary}</div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="empty-cell">No events</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
