import cron, { type ScheduledTask } from "node-cron";
import { getSettings } from "./db.js";
import type { Hardware } from "./hardware/types.js";
import { setRelay } from "./relay.js";

let task: ScheduledTask | null = null;

export function reschedule(getHw: () => Hardware): void {
  if (task) {
    task.stop();
    task = null;
  }
  const s = getSettings();
  if (!s.schedule_enabled) {
    console.log("scheduler: off");
    return;
  }
  if (!cron.validate(s.cron_expr)) {
    console.error("scheduler: bad cron", s.cron_expr);
    return;
  }
  task = cron.schedule(s.cron_expr, () => {
    void setRelay(getHw(), true, "cron", s.duration_sec);
  });
  console.log("scheduler:", s.cron_expr, "duration", s.duration_sec, "s");
}
