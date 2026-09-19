import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.js";

mkdirSync(dirname(config.dbPath), { recursive: true });
export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  temp_c REAL NOT NULL,
  humidity REAL NOT NULL,
  pressure_hpa REAL,
  dew_point_c REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings(ts);
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  schedule_enabled INTEGER NOT NULL DEFAULT 0,
  cron_expr TEXT NOT NULL DEFAULT '0 7 * * *',
  duration_sec INTEGER NOT NULL DEFAULT 60,
  temp_unit TEXT NOT NULL DEFAULT 'C',
  humidity_unit TEXT NOT NULL DEFAULT 'pct',
  pressure_unit TEXT NOT NULL DEFAULT 'hPa',
  theme TEXT NOT NULL DEFAULT 'system',
  wifi_ssid TEXT NOT NULL DEFAULT '',
  wifi_password TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT '',
  static_ip TEXT NOT NULL DEFAULT '',
  gateway TEXT NOT NULL DEFAULT '',
  dns TEXT NOT NULL DEFAULT '',
  relay_gpio INTEGER NOT NULL DEFAULT 17,
  relay_active_low INTEGER NOT NULL DEFAULT 1,
  i2c_bus INTEGER NOT NULL DEFAULT 1,
  bme280_address INTEGER NOT NULL DEFAULT 118
);
CREATE TABLE IF NOT EXISTS irrigation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  action TEXT NOT NULL,
  source TEXT NOT NULL,
  duration_sec INTEGER
);
INSERT OR IGNORE INTO settings (id) VALUES (1);
`);

function ensureColumn(name: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(settings)`).all() as { name: string }[];
  if (!cols.some((c) => c.name === name)) db.exec(`ALTER TABLE settings ADD COLUMN ${ddl}`);
}
ensureColumn("temp_unit", "temp_unit TEXT NOT NULL DEFAULT 'C'");
ensureColumn("humidity_unit", "humidity_unit TEXT NOT NULL DEFAULT 'pct'");
ensureColumn("pressure_unit", "pressure_unit TEXT NOT NULL DEFAULT 'hPa'");
ensureColumn("theme", "theme TEXT NOT NULL DEFAULT 'system'");
ensureColumn("wifi_ssid", "wifi_ssid TEXT NOT NULL DEFAULT ''");
ensureColumn("wifi_password", "wifi_password TEXT NOT NULL DEFAULT ''");
ensureColumn("domain", "domain TEXT NOT NULL DEFAULT ''");
ensureColumn("static_ip", "static_ip TEXT NOT NULL DEFAULT ''");
ensureColumn("gateway", "gateway TEXT NOT NULL DEFAULT ''");
ensureColumn("dns", "dns TEXT NOT NULL DEFAULT ''");
ensureColumn("relay_gpio", "relay_gpio INTEGER NOT NULL DEFAULT 17");
ensureColumn("relay_active_low", "relay_active_low INTEGER NOT NULL DEFAULT 1");
ensureColumn("i2c_bus", "i2c_bus INTEGER NOT NULL DEFAULT 1");
ensureColumn("bme280_address", "bme280_address INTEGER NOT NULL DEFAULT 118");

export type Reading = {
  id?: number; ts: number; temp_c: number; humidity: number;
  pressure_hpa: number | null; dew_point_c: number;
};
export type Settings = {
  schedule_enabled: boolean; cron_expr: string; duration_sec: number;
  temp_unit: "C" | "F"; humidity_unit: "pct" | "ratio";
  pressure_unit: "hPa" | "mmHg" | "inHg";
  theme: "light" | "dark" | "system";
  wifi_ssid: string; wifi_password: string; domain: string;
  static_ip: string; gateway: string; dns: string;
  relay_gpio: number; relay_active_low: boolean; i2c_bus: number; bme280_address: number;
};
const SETTINGS_KEYS: (keyof Settings)[] = [
  "schedule_enabled","cron_expr","duration_sec","temp_unit","humidity_unit","pressure_unit",
  "theme","wifi_ssid","wifi_password","domain","static_ip","gateway","dns",
  "relay_gpio","relay_active_low","i2c_bus","bme280_address",
];
export function insertReading(r: Reading): void {
  db.prepare(`INSERT INTO readings (ts, temp_c, humidity, pressure_hpa, dew_point_c)
     VALUES (@ts, @temp_c, @humidity, @pressure_hpa, @dew_point_c)`).run(r);
}
export function getReadings(fromTs?: number, toTs?: number, limit = 2000): Reading[] {
  const from = fromTs ?? Date.now() - 24 * 60 * 60 * 1000;
  const to = toTs ?? Date.now();
  return db.prepare(`SELECT ts, temp_c, humidity, pressure_hpa, dew_point_c FROM readings WHERE ts BETWEEN ? AND ? ORDER BY ts ASC LIMIT ?`).all(from, to, limit) as Reading[];
}
export function latestReading(): Reading | undefined {
  return db.prepare(`SELECT ts, temp_c, humidity, pressure_hpa, dew_point_c FROM readings ORDER BY ts DESC LIMIT 1`).get() as Reading | undefined;
}
function rowToSettings(row: Record<string, unknown>): Settings {
  return {
    schedule_enabled: Boolean(row.schedule_enabled),
    cron_expr: String(row.cron_expr ?? "0 7 * * *"),
    duration_sec: Number(row.duration_sec ?? 60),
    temp_unit: row.temp_unit === "F" ? "F" : "C",
    humidity_unit: row.humidity_unit === "ratio" ? "ratio" : "pct",
    pressure_unit: row.pressure_unit === "mmHg" || row.pressure_unit === "inHg" ? row.pressure_unit : "hPa",
    theme: row.theme === "light" || row.theme === "dark" || row.theme === "system" ? row.theme : "system",
    wifi_ssid: String(row.wifi_ssid ?? ""),
    wifi_password: String(row.wifi_password ?? ""),
    domain: String(row.domain ?? ""),
    static_ip: String(row.static_ip ?? ""),
    gateway: String(row.gateway ?? ""),
    dns: String(row.dns ?? ""),
    relay_gpio: Number(row.relay_gpio ?? 17),
    relay_active_low: row.relay_active_low === undefined ? true : Boolean(row.relay_active_low),
    i2c_bus: Number(row.i2c_bus ?? 1),
    bme280_address: Number(row.bme280_address ?? 0x76),
  };
}
export function getSettings(): Settings {
  return rowToSettings(db.prepare(`SELECT * FROM settings WHERE id = 1`).get() as Record<string, unknown>);
}
export function updateSettings(partial: Partial<Settings>): Settings {
  const next: Settings = { ...getSettings() };
  for (const key of SETTINGS_KEYS) {
    const val = partial[key];
    if (val !== undefined) (next as unknown as Record<string, unknown>)[key] = val;
  }
  db.prepare(`UPDATE settings SET
      schedule_enabled=@schedule_enabled, cron_expr=@cron_expr, duration_sec=@duration_sec,
      temp_unit=@temp_unit, humidity_unit=@humidity_unit, pressure_unit=@pressure_unit,
      theme=@theme, wifi_ssid=@wifi_ssid, wifi_password=@wifi_password, domain=@domain,
      static_ip=@static_ip, gateway=@gateway, dns=@dns, relay_gpio=@relay_gpio,
      relay_active_low=@relay_active_low, i2c_bus=@i2c_bus, bme280_address=@bme280_address
     WHERE id=1`).run({ ...next, schedule_enabled: Number(next.schedule_enabled), relay_active_low: Number(next.relay_active_low) });
  return getSettings();
}
export function insertEvent(action: string, source: string, durationSec?: number): void {
  db.prepare(`INSERT INTO irrigation_events (ts, action, source, duration_sec) VALUES (?, ?, ?, ?)`).run(Date.now(), action, source, durationSec ?? null);
}
export function getEvents(limit = 50) {
  return db.prepare(`SELECT ts, action, source, duration_sec FROM irrigation_events ORDER BY ts DESC LIMIT ?`).all(limit);
}
export function countReadings(): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM readings`).get() as { n: number }).n;
}
