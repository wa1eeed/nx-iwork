// Cron helpers for AgentSchedule. Computing "next run" from a stored cron
// expression lives here so the scheduler worker and the actions agree.

import parser from 'cron-parser';

// Returns the next fire time after `from` in the given timezone, or null if the
// expression is invalid (callers reject invalid input).
export function computeNextRun(
  cronExpression: string,
  timezone: string,
  from: Date = new Date()
): Date | null {
  try {
    const it = parser.parseExpression(cronExpression, {
      tz: timezone,
      currentDate: from,
    });
    return it.next().toDate();
  } catch {
    return null;
  }
}

export function isValidCron(cronExpression: string, timezone: string): boolean {
  return computeNextRun(cronExpression, timezone) !== null;
}

// Every fire time of a cron expression within (from, to], for the scheduled-runs
// calendar. Capped so a per-minute expression over a wide window can't blow up
// the payload. Returns [] on an invalid expression (the iterator also throws
// once it passes `to` — that's the normal stop, not an error).
export function expandOccurrences(
  cronExpression: string,
  timezone: string,
  from: Date,
  to: Date,
  cap = 300
): Date[] {
  const out: Date[] = [];
  try {
    const it = parser.parseExpression(cronExpression, {
      tz: timezone,
      currentDate: from,
      endDate: to,
    });
    while (out.length < cap && it.hasNext()) {
      out.push(it.next().toDate());
    }
  } catch {
    // Invalid expression, or the iterator ran past `to`.
  }
  return out;
}
