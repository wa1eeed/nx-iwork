import { runLeasedCronTick } from './run-tick';

// In-process autonomous engine. When CRON_SELF=1, the app drives its own
// scheduler on a fixed interval — no external Coolify Scheduled Task needed,
// which is the piece that kept the whole autonomy layer (scheduled tasks, event
// tasks, booking reminders, subscription renewals, delegation chains) inert in
// production. OFF by default: without the flag this module does nothing, so
// enabling it is a single env var instead of wrestling a cron entry.
//
// Safety: a DB lease (runLeasedCronTick) makes it single-flight across replicas,
// and the in-process `running` guard prevents a slow tick from overlapping the
// next one. Cost stays bounded by each company's automationEnabled toggle plus
// the per-agent / per-company token caps.

const TICK_MS = 60_000;
// Win the lease only if no tick ran in the last ~55s (slightly under the interval
// so a fresh tick always qualifies, but a duplicate replica in the same second
// does not).
const LEASE_MS = TICK_MS - 5_000;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function tick(): Promise<void> {
  if (running) return; // never overlap within this process
  running = true;
  try {
    const summary = await runLeasedCronTick(LEASE_MS);
    if (summary) {
      const { schedules, events, reminders, reaped, renewals } = summary;
      console.log('[self-cron] tick', JSON.stringify({ schedules, events, reminders, reaped, renewals }));
    }
  } catch (err) {
    console.error('[self-cron] tick failed', err);
  } finally {
    running = false;
  }
}

// Start the interval once per process. Idempotent + no-op unless CRON_SELF=1.
export function startSelfCron(): void {
  if (process.env.CRON_SELF !== '1') return;
  if (timer) return;
  timer = setInterval(() => void tick(), TICK_MS);
  // First pass shortly after boot — let the server settle, don't block startup.
  setTimeout(() => void tick(), 10_000);
  console.log('[self-cron] in-process autonomous engine ON (every 60s)');
}
