// Standalone scheduler worker.
//
// Run as ONE instance (separate from the web app) — e.g. a second Coolify
// service on the same image with the command `npm run scheduler`. A single
// worker avoids duplicate cron fires across web replicas.
//
//   npm run scheduler
//
// It polls every minute and runs any AgentSchedule that's due. The loop is
// self-scheduling (sleep AFTER each tick completes) so a long agent run can't
// overlap the next tick.

import { runDueSchedules, runPendingEventTasks } from '@/lib/agent/scheduler';

const POLL_MS = 60_000;
let stopping = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tick(): Promise<void> {
  try {
    const s = await runDueSchedules();
    const e = await runPendingEventTasks();
    if (s.due > 0 || e.due > 0) {
      console.log(
        `[scheduler] schedules(due=${s.due} ran=${s.ran} failed=${s.failed}) ` +
          `events(due=${e.due} ran=${e.ran} failed=${e.failed})`
      );
    }
  } catch (err) {
    console.error('[scheduler] tick failed', err);
  }
}

async function main(): Promise<void> {
  console.log('[scheduler] started — polling every 60s');
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      console.log(`[scheduler] ${sig} — shutting down`);
      stopping = true;
    });
  }
  while (!stopping) {
    await tick();
    if (!stopping) await sleep(POLL_MS);
  }
  process.exit(0);
}

main();
