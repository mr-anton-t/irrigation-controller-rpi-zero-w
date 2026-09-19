import cron, { type ScheduledTask } from "node-cron";
import { listSchedules, scheduleToCron } from "./db.js";
import type { Hardware } from "./hardware/types.js";
import { setRelay } from "./relay.js";

const tasks: ScheduledTask[] = [];

export function reschedule(getHw: () => Hardware): void {
  for (const t of tasks) t.stop();
  tasks.length = 0;

  const items = listSchedules().filter((s) => s.enabled);
  if (!items.length) {
    console.log("scheduler: off");
    return;
  }

  for (const s of items) {
    const expr = scheduleToCron(s);
    if (!cron.validate(expr)) {
      console.error("scheduler: bad", s.id, expr);
      continue;
    }
    const task = cron.schedule(expr, () => {
      void setRelay(getHw(), true, `schedule:${s.id}`, s.duration_sec);
    });
    tasks.push(task);
    console.log("scheduler:", s.id, expr, s.duration_sec, "s");
  }
}
