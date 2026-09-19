import { insertEvent } from "./db.js";
import type { Hardware } from "./hardware/types.js";

let offTimer: NodeJS.Timeout | null = null;

export async function setRelay(
  hw: Hardware,
  on: boolean,
  source: string,
  durationSec?: number
): Promise<{ on: boolean; until: number | null }> {
  if (offTimer) {
    clearTimeout(offTimer);
    offTimer = null;
  }
  await hw.setRelay(on);
  insertEvent(on ? "on" : "off", source, durationSec);

  let until: number | null = null;
  if (on && durationSec && durationSec > 0) {
    until = Date.now() + durationSec * 1000;
    offTimer = setTimeout(() => {
      void hw.setRelay(false).then(() => insertEvent("off", "timer", durationSec));
    }, durationSec * 1000);
  }
  return { on: hw.getRelay(), until };
}
