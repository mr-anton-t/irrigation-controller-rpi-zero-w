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
  bme280_address INTEGER NOT NULL DEFAULT 118,
  ntp_server TEXT NOT NULL DEFAULT 'pool.ntp.org'
);

CREATE TABLE IF NOT EXISTS irrigation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  action TEXT NOT NULL,
  source TEXT NOT NULL,
  duration_sec INTEGER
);

INSERT OR IGNORE INTO settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enabled INTEGER NOT NULL DEFAULT 1,
  days TEXT NOT NULL DEFAULT 'all',
  time_hm TEXT NOT NULL DEFAULT '07:00',
  duration_sec INTEGER NOT NULL DEFAULT 60
);
`);

function ensureColumn(name: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(settings)`).all() as { name: string }[];
  if (!cols.some((c) => c.name === name)) {
    db.exec(`ALTER TABLE settings ADD COLUMN ${ddl}`);
  }
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
ensureColumn("ntp_server", "ntp_server TEXT NOT NULL DEFAULT 'pool.ntp.org'");

export type Reading = {
  id?: number;
  ts: number;
  temp_c: number;
  humidity: number;
  pressure_hpa: number | null;
  dew_point_c: number;
};

export type Schedule = {
  id: number;
  enabled: boolean;
  days: string;
  time_hm: string;
  duration_sec: number;
};

export type Settings = {
  schedule_enabled: boolean;
  cron_expr: string;
  duration_sec: number;
  temp_unit: "C" | "F";
  humidity_unit: "pct" | "ratio";
  pressure_unit: "hPa" | "mmHg" | "inHg";
  theme: "light" | "dark" | "system";
  wifi_ssid: string;
  wifi_password: string;
  domain: string;
  static_ip: string;
  gateway: string;
  dns: string;
  relay_gpio: number;
  relay_active_low: boolean;
  i2c_bus: number;
  bme280_address: number;
  ntp_server: string;
};

const SETTINGS_KEYS: (keyof Settings)[] = [
  "schedule_enabled",
  "cron_expr",
  "duration_sec",
  "temp_unit",
  "humidity_unit",
  "pressure_unit",
  "theme",
  "wifi_ssid",
  "wifi_password",
  "domain",
  "static_ip",
  "gateway",
  "dns",
  "relay_gpio",
  "relay_active_low",
  "i2c_bus",
  "bme280_address",
  "ntp_server",
];

export function insertReading(r: Reading): void {
  db.prepare(
    `INSERT INTO readings (ts, temp_c, humidity, pressure_hpa, dew_point_c)
     VALUES (@ts, @temp_c, @humidity, @pressure_hpa, @dew_point_c)`
  ).run(r);
}

export function getReadings(fromTs?: number, toTs?: number, limit = 2000): Reading[] {
  const from = fromTs ?? Date.now() - 24 * 60 * 60 * 1000;
  const to = toTs ?? Date.now();
  return db
    .prepare(
      `SELECT ts, temp_c, humidity, pressure_hpa, dew_point_c
       FROM readings WHERE ts BETWEEN ? AND ? ORDER BY ts ASC LIMIT ?`
    )
    .all(from, to, limit) as Reading[];
}

export function latestReading(): Reading | undefined {
  return db
    .prepare(
      `SELECT ts, temp_c, humidity, pressure_hpa, dew_point_c
       FROM readings ORDER BY ts DESC LIMIT 1`
    )
    .get() as Reading | undefined;
}

function rowToSettings(row: Record<string, unknown>): Settings {
  return {
    schedule_enabled: Boolean(row.schedule_enabled),
    cron_expr: String(row.cron_expr ?? "0 7 * * *"),
    duration_sec: Number(row.duration_sec ?? 60),
    temp_unit: row.temp_unit === "F" ? "F" : "C",
    humidity_unit: row.humidity_unit === "ratio" ? "ratio" : "pct",
    pressure_unit:
      row.pressure_unit === "mmHg" || row.pressure_unit === "inHg"
        ? row.pressure_unit
        : "hPa",
    theme:
      row.theme === "light" || row.theme === "dark" || row.theme === "system"
        ? row.theme
        : "system",
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
    ntp_server: String(row.ntp_server || "pool.ntp.org"),
  };
}

export function getSettings(): Settings {
  const row = db.prepare(`SELECT * FROM settings WHERE id = 1`).get() as Record<
    string,
    unknown
  >;
  return rowToSettings(row);
}

export function updateSettings(partial: Partial<Settings>): Settings {
  const cur = getSettings();
  const next: Settings = { ...cur };
  for (const key of SETTINGS_KEYS) {
    const val = partial[key];
    if (val !== undefined) {
      (next as unknown as Record<string, unknown>)[key] = val;
    }
  }
  db.prepare(
    `UPDATE settings SET
      schedule_enabled = @schedule_enabled,
      cron_expr = @cron_expr,
      duration_sec = @duration_sec,
      temp_unit = @temp_unit,
      humidity_unit = @humidity_unit,
      pressure_unit = @pressure_unit,
      theme = @theme,
      wifi_ssid = @wifi_ssid,
      wifi_password = @wifi_password,
      domain = @domain,
      static_ip = @static_ip,
      gateway = @gateway,
      dns = @dns,
      relay_gpio = @relay_gpio,
      relay_active_low = @relay_active_low,
      i2c_bus = @i2c_bus,
      bme280_address = @bme280_address,
      ntp_server = @ntp_server
     WHERE id = 1`
  ).run({
    ...next,
    schedule_enabled: Number(next.schedule_enabled),
    relay_active_low: Number(next.relay_active_low),
  });
  return getSettings();
}

export function insertEvent(action: string, source: string, durationSec?: number): void {
  db.prepare(
    `INSERT INTO irrigation_events (ts, action, source, duration_sec) VALUES (?, ?, ?, ?)`
  ).run(Date.now(), action, source, durationSec ?? null);
}

export function getEvents(limit = 50) {
  return db
    .prepare(
      `SELECT ts, action, source, duration_sec FROM irrigation_events ORDER BY ts DESC LIMIT ?`
    )
    .all(limit);
}

function rowToSchedule(row: Record<string, unknown>): Schedule {
  return {
    id: Number(row.id),
    enabled: Boolean(row.enabled),
    days: String(row.days ?? "all"),
    time_hm: String(row.time_hm ?? "07:00"),
    duration_sec: Number(row.duration_sec ?? 60),
  };
}

export function listSchedules(): Schedule[] {
  migrateLegacySchedule();
  return db
    .prepare(`SELECT id, enabled, days, time_hm, duration_sec FROM schedules ORDER BY id`)
    .all()
    .map((r) => rowToSchedule(r as Record<string, unknown>));
}

function migrateLegacySchedule(): void {
  const n = (db.prepare(`SELECT COUNT(*) AS n FROM schedules`).get() as { n: number }).n;
  if (n > 0) return;
  const s = getSettings();
  const parsed = cronToSchedule(s.cron_expr);
  db.prepare(
    `INSERT INTO schedules (enabled, days, time_hm, duration_sec) VALUES (?, ?, ?, ?)`
  ).run(Number(s.schedule_enabled), parsed.days, parsed.time_hm, s.duration_sec);
}

export function cronToSchedule(expr: string): { days: string; time_hm: string } {
  const parts = String(expr || "").trim().split(/\s+/);
  if (parts.length < 5) return { days: "all", time_hm: "07:00" };
  const minute = Number(parts[0]);
  const hour = Number(parts[1]);
  const dow = parts[4];
  const mm = Number.isFinite(minute) ? String(minute).padStart(2, "0") : "00";
  const hh = Number.isFinite(hour) ? String(hour).padStart(2, "0") : "07";
  const days = !dow || dow === "*" ? "all" : dow.replace(/7/g, "0");
  return { days, time_hm: `${hh}:${mm}` };
}

export function scheduleToCron(s: { days: string; time_hm: string }): string {
  const [hh, mm] = (s.time_hm || "07:00").split(":");
  const minute = String(Number(mm) || 0);
  const hour = String(Number(hh) || 0);
  const days = !s.days || s.days === "all" ? "*" : s.days;
  return `${minute} ${hour} * * ${days}`;
}

export function createSchedule(partial: Partial<Schedule> = {}): Schedule {
  const info = db
    .prepare(
      `INSERT INTO schedules (enabled, days, time_hm, duration_sec) VALUES (?, ?, ?, ?)`
    )
    .run(
      Number(partial.enabled ?? true),
      partial.days ?? "all",
      partial.time_hm ?? "07:00",
      Number(partial.duration_sec ?? 60)
    );
  return getSchedule(Number(info.lastInsertRowid))!;
}

export function getSchedule(id: number): Schedule | undefined {
  const row = db.prepare(`SELECT * FROM schedules WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToSchedule(row) : undefined;
}

export function updateSchedule(id: number, partial: Partial<Schedule>): Schedule | undefined {
  const cur = getSchedule(id);
  if (!cur) return undefined;
  const next = {
    enabled: partial.enabled ?? cur.enabled,
    days: partial.days ?? cur.days,
    time_hm: partial.time_hm ?? cur.time_hm,
    duration_sec: partial.duration_sec ?? cur.duration_sec,
  };
  db.prepare(
    `UPDATE schedules SET enabled = ?, days = ?, time_hm = ?, duration_sec = ? WHERE id = ?`
  ).run(Number(next.enabled), next.days, next.time_hm, next.duration_sec, id);
  return getSchedule(id);
}

export function deleteSchedule(id: number): boolean {
  const info = db.prepare(`DELETE FROM schedules WHERE id = ?`).run(id);
  return info.changes > 0;
}

export function countReadings(): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM readings`).get() as { n: number };
  return row.n;
}
