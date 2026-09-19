import { insertEvent } from "./db.js";
import type { Hardware } from "./hardware/types.js";

let offTimer: NodeJS.Timeout | null = null;
let offAt: number | null = null;

function armOff(hw: Hardware, until: number, durationSec: number): void {
  if (offTimer) {
    clearTimeout(offTimer);
    offTimer = null;
  }
  offAt = until;
  const delay = Math.max(0, until - Date.now());
  offTimer = setTimeout(() => {
    offTimer = null;
    offAt = null;
    void hw.setRelay(false).then(() => insertEvent("off", "timer", durationSec));
  }, delay);
}

export async function setRelay(
  hw: Hardware,
  on: boolean,
  source: string,
  durationSec?: number
): Promise<{ on: boolean; until: number | null }> {
  if (!on) {
    if (offTimer) {
      clearTimeout(offTimer);
      offTimer = null;
    }
    offAt = null;
    await hw.setRelay(false);
    insertEvent("off", source, durationSec);
    return { on: hw.getRelay(), until: null };
  }

  await hw.setRelay(true);
  insertEvent("on", source, durationSec);

  if (durationSec && durationSec > 0) {
    const until = Date.now() + durationSec * 1000;
    if (offAt === null || until > offAt) {
      armOff(hw, until, durationSec);
    }
  }

  return { on: hw.getRelay(), until: offAt };
}
