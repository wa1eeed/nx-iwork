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
