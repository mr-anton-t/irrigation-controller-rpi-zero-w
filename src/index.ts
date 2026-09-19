import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "./config.js";
import {
  getEvents,
  getReadings,
  getSettings,
  latestReading,
  updateSettings,
  countReadings,
} from "./db.js";
import { createHardware } from "./hardware/index.js";
import { startSampler } from "./sampler.js";
import { setRelay } from "./relay.js";
import { reschedule } from "./scheduler.js";
import { applyNetworkHint, currentNetwork } from "./network.js";
import type { Settings } from "./db.js";

const root = dirname(fileURLToPath(import.meta.url));
const publicDir = join(root, "..", "public");

function processMemory() {
  const m = process.memoryUsage();
  const mb = (n: number) => Math.round((n / 1024 / 1024) * 10) / 10;
  return {
    rss_mb: mb(m.rss),
    heap_used_mb: mb(m.heapUsed),
    heap_total_mb: mb(m.heapTotal),
    external_mb: mb(m.external),
    array_buffers_mb: mb(m.arrayBuffers),
  };
}

async function seedIfEmpty() {
  if (countReadings() > 0) return;
  const { dewPointC } = await import("./dewpoint.js");
  const { insertReading } = await import("./db.js");
  const now = Date.now();
  const step = 5 * 60 * 1000;
  for (let i = 288; i >= 0; i--) {
    const ts = now - i * step;
    const hour = new Date(ts).getHours() + new Date(ts).getMinutes() / 60;
    const temp = 18 + 6 * Math.sin(((hour - 8) / 24) * Math.PI * 2);
    const humidity = 55 - 8 * Math.sin(((hour - 8) / 24) * Math.PI * 2);
    insertReading({
      ts,
      temp_c: Number(temp.toFixed(2)),
      humidity: Number(humidity.toFixed(2)),
      pressure_hpa: 1012,
      dew_point_c: dewPointC(temp, humidity),
    });
  }
  console.log("seeded 24h mock history");
}

let hw = await createHardware();
if (config.useMock) await seedIfEmpty();
const getHw = () => hw;
startSampler(getHw);
reschedule(getHw);

const app = Fastify({ logger: true });

await app.register(fastifyStatic, { root: publicDir });

app.get("/api/status", async () => ({
  mock: config.useMock,
  relayOn: getHw().getRelay(),
  reading: latestReading() ?? null,
  settings: getSettings(),
  network: currentNetwork(),
  memory: processMemory(),
}));

app.post<{ Body: { on?: boolean; durationSec?: number } }>("/api/relay", async (req) => {
  const on = req.body?.on ?? !hw.getRelay();
  const duration = req.body?.durationSec;
  return setRelay(getHw(), on, "button", duration);
});

app.get("/api/readings", async (req) => {
  const q = req.query as { from?: string; to?: string };
  return getReadings(q.from ? Number(q.from) : undefined, q.to ? Number(q.to) : undefined);
});

app.get("/api/settings", async () => getSettings());

app.get("/api/network", async () => currentNetwork());

app.put<{ Body: Partial<Settings> }>("/api/settings", async (req) => {
  const prev = getSettings();
  const next = updateSettings(req.body ?? {});
  reschedule(getHw);
  const pinsChanged =
    prev.relay_gpio !== next.relay_gpio ||
    prev.relay_active_low !== next.relay_active_low ||
    prev.i2c_bus !== next.i2c_bus ||
    prev.bme280_address !== next.bme280_address;
  if (pinsChanged && !config.useMock) {
    await hw.close();
    hw = await createHardware();
  }
  const net = applyNetworkHint(next);
  return { ...next, network_apply: net, pins_reloaded: pinsChanged && !config.useMock };
});

app.get("/api/events", async () => getEvents());

const stop = async () => {
  await hw.close();
  await app.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

await app.listen({ port: config.port, host: "0.0.0.0" });
console.log(`http://localhost:${config.port}`);
