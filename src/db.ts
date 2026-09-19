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
  duration_sec INTEGER NOT NULL DEFAULT 60,
  last_fired TEXT NOT NULL DEFAULT ''
);
`);

function ensureColumn(table: string, name: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

ensureColumn("settings", "temp_unit", "temp_unit TEXT NOT NULL DEFAULT 'C'");
ensureColumn("settings", "humidity_unit", "humidity_unit TEXT NOT NULL DEFAULT 'pct'");
ensureColumn("settings", "pressure_unit", "pressure_unit TEXT NOT NULL DEFAULT 'hPa'");
ensureColumn("settings", "theme", "theme TEXT NOT NULL DEFAULT 'system'");
ensureColumn("settings", "wifi_ssid", "wifi_ssid TEXT NOT NULL DEFAULT ''");
ensureColumn("settings", "wifi_password", "wifi_password TEXT NOT NULL DEFAULT ''");
ensureColumn("settings", "domain", "domain TEXT NOT NULL DEFAULT ''");
ensureColumn("settings", "static_ip", "static_ip TEXT NOT NULL DEFAULT ''");
ensureColumn("settings", "gateway", "gateway TEXT NOT NULL DEFAULT ''");
ensureColumn("settings", "dns", "dns TEXT NOT NULL DEFAULT ''");
ensureColumn("settings", "relay_gpio", "relay_gpio INTEGER NOT NULL DEFAULT 17");
ensureColumn("settings", "relay_active_low", "relay_active_low INTEGER NOT NULL DEFAULT 1");
ensureColumn("settings", "i2c_bus", "i2c_bus INTEGER NOT NULL DEFAULT 1");
ensureColumn("settings", "bme280_address", "bme280_address INTEGER NOT NULL DEFAULT 118");
ensureColumn("settings", "ntp_server", "ntp_server TEXT NOT NULL DEFAULT 'pool.ntp.org'");
ensureColumn("settings", "schedules_imported", "schedules_imported INTEGER NOT NULL DEFAULT 0");
ensureColumn("schedules", "last_fired", "last_fired TEXT NOT NULL DEFAULT ''");

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
  schedules_imported: boolean;
};

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

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
  "schedules_imported",
];

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;
const MAX_CRON_SLOTS = 24;

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
    schedules_imported: Boolean(row.schedules_imported),
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
      ntp_server = @ntp_server,
      schedules_imported = @schedules_imported
     WHERE id = 1`
  ).run({
    ...next,
    schedule_enabled: Number(next.schedule_enabled),
    relay_active_low: Number(next.relay_active_low),
    schedules_imported: Number(next.schedules_imported),
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
  return db
    .prepare(`SELECT id, enabled, days, time_hm, duration_sec FROM schedules ORDER BY id`)
    .all()
    .map((r) => rowToSchedule(r as Record<string, unknown>));
}

function expandCronField(field: string, min: number, max: number): number[] | null {
  const raw = String(field || "").trim();
  if (!raw) return null;
  const out = new Set<number>();
  for (const token of raw.split(",")) {
    const piece = token.trim();
    if (!piece) continue;
    const [rangePart, stepPart] = piece.split("/");
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step < 1) return null;
    let start: number;
    let end: number;
    if (rangePart === "*") {
      start = min;
      end = max;
    } else if (rangePart.includes("-")) {
      const [aStr, bStr] = rangePart.split("-");
      start = Number(aStr);
      end = Number(bStr);
    } else {
      start = Number(rangePart);
      end = start;
    }
    if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
    if (start < min || end > max || start > end) return null;
    for (let i = start; i <= end; i += step) out.add(i);
  }
  if (!out.size) return null;
  return [...out].sort((a, b) => a - b);
}

function expandDow(field: string): string {
  const raw = String(field || "").trim();
  if (!raw || raw === "*") return "all";
  const out = new Set<number>();
  for (const token of raw.split(",")) {
    const piece = token.trim();
    if (!piece) continue;
    const [rangePart, stepPart] = piece.split("/");
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step < 1) continue;
    let start: number;
    let end: number;
    if (rangePart === "*") {
      start = 0;
      end = 6;
    } else if (rangePart.includes("-")) {
      const [aStr, bStr] = rangePart.split("-");
      start = Number(aStr);
      end = Number(bStr);
    } else {
      start = Number(rangePart);
      end = start;
    }
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    if (start === 7) start = 0;
    if (end === 7) end = 0;
    if (start > end) {
      for (let i = start; i <= 7; i += step) {
        const d = i === 7 ? 0 : i;
        if (d >= 0 && d <= 6) out.add(d);
      }
      for (let i = 0; i <= end; i += step) {
        if (i >= 0 && i <= 6) out.add(i);
      }
      continue;
    }
    for (let i = start; i <= end; i += step) {
      const d = i === 7 ? 0 : i;
      if (d >= 0 && d <= 6) out.add(d);
    }
  }
  if (!out.size) return "all";
  if (out.size === 7) return "all";
  return [...out].sort((a, b) => a - b).join(",");
}

function fieldIsAny(field: string): boolean {
  const raw = String(field || "").trim();
  return raw === "*" || raw === "*/1";
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function cronToSchedules(expr: string): { days: string; time_hm: string }[] {
  const parts = String(expr || "").trim().split(/\s+/);
  let minuteF: string;
  let hourF: string;
  let domF: string;
  let monthF: string;
  let dowF: string;
  if (parts.length >= 6) {
    minuteF = parts[1];
    hourF = parts[2];
    domF = parts[3];
    monthF = parts[4];
    dowF = parts[5];
  } else if (parts.length === 5) {
    minuteF = parts[0];
    hourF = parts[1];
    domF = parts[2];
    monthF = parts[3];
    dowF = parts[4];
  } else {
    return [];
  }
  if (!fieldIsAny(domF) || !fieldIsAny(monthF)) return [];
  const minutes = expandCronField(minuteF, 0, 59);
  const hours = expandCronField(hourF, 0, 23);
  if (!minutes || !hours) return [];
  if (minutes.length * hours.length > MAX_CRON_SLOTS) return [];
  const days = expandDow(dowF);
  const out: { days: string; time_hm: string }[] = [];
  for (const hour of hours) {
    for (const minute of minutes) {
      out.push({ days, time_hm: `${pad2(hour)}:${pad2(minute)}` });
    }
  }
  return out;
}

export function scheduleMatchesDow(days: string, dow: number): boolean {
  if (!days || days === "all" || days === "*") return true;
  return days.split(",").map((x) => x.trim()).includes(String(dow));
}

export function normalizeDays(days: unknown, fallback = "all"): string {
  if (days === undefined || days === null) return fallback;
  const raw = String(days).trim();
  if (!raw) throw new ValidationError("days: выберите хотя бы один день");
  if (raw === "all" || raw === "*") return "all";
  const out = new Set<number>();
  for (const part of raw.split(",")) {
    const token = part.trim();
    if (!token) continue;
    if (!/^[0-6]$/.test(token)) {
      throw new ValidationError("days: допустимы 0–6 или all");
    }
    out.add(Number(token));
  }
  if (!out.size) throw new ValidationError("days: выберите хотя бы один день");
  if (out.size === 7) return "all";
  return [...out].sort((a, b) => a - b).join(",");
}

export function normalizeTimeHm(value: unknown, fallback = "07:00"): string {
  if (value === undefined || value === null || value === "") return fallback;
  const raw = String(value).trim();
  const m = TIME_RE.exec(raw);
  if (!m) throw new ValidationError("time_hm: формат HH:MM");
  return `${m[1]}:${m[2]}`;
}

export function normalizeDurationSec(value: unknown, fallback = 60): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 3600) {
    throw new ValidationError("duration_sec: целое число 1–3600");
  }
  return n;
}

export function normalizeEnabled(value: unknown, fallback = true): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  throw new ValidationError("enabled: ожидается boolean");
}

export function parseScheduleId(raw: string): number {
  if (!/^\d+$/.test(String(raw || ""))) {
    throw new ValidationError("id: ожидается целое число");
  }
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new ValidationError("id: ожидается целое число");
  }
  return id;
}

export function scheduleFiredStamp(id: number): string {
  const row = db.prepare(`SELECT last_fired FROM schedules WHERE id = ?`).get(id) as
    | { last_fired?: string }
    | undefined;
  return String(row?.last_fired ?? "");
}

export function markScheduleFired(id: number, stamp: string): void {
  db.prepare(`UPDATE schedules SET last_fired = ? WHERE id = ?`).run(stamp, id);
}

export function migrateLegacySchedule(): void {
  const s = getSettings();
  if (s.schedules_imported) return;
  const n = (db.prepare(`SELECT COUNT(*) AS n FROM schedules`).get() as { n: number }).n;
  if (n === 0) {
    const rows = cronToSchedules(s.cron_expr);
    if (rows.length) {
      const ins = db.prepare(
        `INSERT INTO schedules (enabled, days, time_hm, duration_sec) VALUES (?, ?, ?, ?)`
      );
      for (const parsed of rows) {
        ins.run(Number(s.schedule_enabled), parsed.days, parsed.time_hm, s.duration_sec);
      }
    } else {
      console.log("legacy cron not imported (not representable as HH:MM slots):", s.cron_expr);
    }
  }
  updateSettings({ schedules_imported: true });
}

export function createSchedule(partial: Partial<Schedule> = {}): Schedule {
  const enabled = normalizeEnabled(partial.enabled, true);
  const days = normalizeDays(partial.days, "all");
  const time_hm = normalizeTimeHm(partial.time_hm, "07:00");
  const duration_sec = normalizeDurationSec(partial.duration_sec, 60);
  const info = db
    .prepare(
      `INSERT INTO schedules (enabled, days, time_hm, duration_sec) VALUES (?, ?, ?, ?)`
    )
    .run(Number(enabled), days, time_hm, duration_sec);
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
    enabled: normalizeEnabled(partial.enabled, cur.enabled),
    days: partial.days !== undefined ? normalizeDays(partial.days, cur.days) : cur.days,
    time_hm: partial.time_hm !== undefined ? normalizeTimeHm(partial.time_hm, cur.time_hm) : cur.time_hm,
    duration_sec:
      partial.duration_sec !== undefined
        ? normalizeDurationSec(partial.duration_sec, cur.duration_sec)
        : cur.duration_sec,
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
