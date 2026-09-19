import { dewPointC } from "./dewpoint.js";
import { insertReading } from "./db.js";
import type { Hardware } from "./hardware/types.js";
import { config } from "./config.js";

export function startSampler(getHw: () => Hardware): NodeJS.Timeout {
  const tick = async () => {
    try {
      const s = await getHw().readSensor();
      insertReading({
        ts: Date.now(),
        temp_c: s.tempC,
        humidity: s.humidity,
        pressure_hpa: s.pressureHpa,
        dew_point_c: dewPointC(s.tempC, s.humidity),
      });
    } catch (err) {
      console.error("sampler error", err);
    }
  };
  void tick();
  return setInterval(tick, config.sampleIntervalMs);
}
