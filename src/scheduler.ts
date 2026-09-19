import { listSchedules, scheduleMatchesDow } from "./db.js";
import type { Hardware } from "./hardware/types.js";
import { setRelay } from "./relay.js";

let timer: NodeJS.Timeout | null = null;
let getHwRef: (() => Hardware) | null = null;
const fired = new Set<string>();

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function tick(): void {
  if (!getHwRef) return;
  const now = new Date();
  const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const dow = now.getDay();
  const dayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  for (const key of [...fired]) {
    const at = key.indexOf("@");
    const dayPart = at >= 0 ? key.slice(at + 1, at + 11) : "";
    if (dayPart && dayPart !== dayKey) fired.delete(key);
  }

  for (const s of listSchedules()) {
    if (!s.enabled) continue;
    if (!scheduleMatchesDow(s.days, dow)) continue;
    if (s.time_hm !== hm) continue;
    const key = `${s.id}@${dayKey}T${hm}`;
    if (fired.has(key)) continue;
    fired.add(key);
    void setRelay(getHwRef(), true, `schedule:${s.id}`, s.duration_sec);
  }
}

export function reschedule(getHw: () => Hardware): void {
  getHwRef = getHw;
  if (!timer) {
    timer = setInterval(tick, 1000);
    tick();
  }
  const items = listSchedules().filter((s) => s.enabled);
  if (!items.length) console.log("scheduler: off");
  else {
    for (const s of items) {
      console.log("scheduler:", s.id, s.days, s.time_hm, s.duration_sec, "s");
    }
  }
}
