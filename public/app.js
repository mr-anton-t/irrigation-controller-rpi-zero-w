const $ = (id) => document.getElementById(id);

const DAY_DEFS = [
  { v: "1", l: "Пн" },
  { v: "2", l: "Вт" },
  { v: "3", l: "Ср" },
  { v: "4", l: "Чт" },
  { v: "5", l: "Пт" },
  { v: "6", l: "Сб" },
  { v: "0", l: "Вс" },
];

let schedulesDirty = false;
let durDirty = false;
let lastSchedSig = "";

function parseDays(days) {
  if (!days || days === "all") return new Set(DAY_DEFS.map((d) => d.v));
  return new Set(String(days).split(",").map((x) => x.trim()).filter(Boolean));
}

function daysFromChecks(root) {
  const all = root.querySelector('[data-day="all"]');
  if (all?.checked) return "all";
  const picked = [...root.querySelectorAll("[data-day]:not([data-day=all])")]
    .filter((el) => el.checked)
    .map((el) => el.dataset.day);
  return picked.join(",");
}

function scheduleCard(s) {
  const set = parseDays(s.days);
  const allOn = s.days === "all" || set.size === 7;
  const daysHtml = `
    <label class="day"><input type="checkbox" data-day="all" ${allOn ? "checked" : ""} /> все</label>
    ${DAY_DEFS.map(
      (d) =>
        `<label class="day"><input type="checkbox" data-day="${d.v}" ${
          allOn || set.has(d.v) ? "checked" : ""
        } /> ${d.l}</label>`
    ).join("")}
  `;
  return `<div class="sched" data-id="${s.id}">
    <div class="row" style="margin-top:0; justify-content:space-between">
      <label><input type="checkbox" data-en ${s.enabled ? "checked" : ""} /> включено</label>
      <button class="sec danger" type="button" data-del>Удалить</button>
    </div>
    <div class="days">${daysHtml}</div>
    <div class="row">
      <label class="muted">Время</label>
      <input type="time" data-time value="${s.time_hm}" style="width:140px" />
      <label class="muted">сек</label>
      <input type="number" min="1" max="3600" data-dur value="${s.duration_sec}" style="width:90px" />
      <button class="sec" type="button" data-save>Сохранить</button>
    </div>
  </div>`;
}

function schedSig(list) {
  return JSON.stringify(
    (list || []).map((s) => [s.id, s.enabled, s.days, s.time_hm, s.duration_sec])
  );
}

async function persistDuration(sec) {
  const n = Number(sec);
  if (!Number.isInteger(n) || n < 1 || n > 3600) return;
  await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ duration_sec: n }),
  });
}

async function refresh() {
  const s = await fetch("/api/status").then((r) => r.json());
  applyTheme(s.settings.theme);
  localStorage.setItem(THEME_KEY, s.settings.theme);
  const u = labelsFor(s.settings);
  $("mode").textContent = (s.mock ? "режим: mock" : "режим: железо") +
    (s.network?.primary_ip ? ` · ${s.network.primary_ip}` : "");
  const r = s.reading;
  if (r) {
    $("t").textContent = fmt(convertTemp(r.temp_c, s.settings.temp_unit)) + " " + u.temp;
    $("h").textContent = fmt(convertHumidity(r.humidity, s.settings.humidity_unit), s.settings.humidity_unit === "ratio" ? 3 : 1) + " " + u.humidity;
    $("d").textContent = fmt(convertTemp(r.dew_point_c, s.settings.temp_unit)) + " " + u.temp;
    $("p").textContent = fmt(convertPressure(r.pressure_hpa, s.settings.pressure_unit)) + " " + u.pressure;
  }
  $("btn").textContent = s.relayOn ? "Стоп" : "Полить";
  $("btn").classList.toggle("off", s.relayOn);
  if (!durDirty && document.activeElement !== $("dur")) {
    $("dur").value = s.settings.duration_sec;
  }
  const nextSig = schedSig(s.schedules);
  if (!schedulesDirty && nextSig !== lastSchedSig) {
    lastSchedSig = nextSig;
    $("schedules").innerHTML = (s.schedules || []).map(scheduleCard).join("") ||
      '<p class="muted">Нет расписаний</p>';
  }
}

$("dur").addEventListener("input", () => {
  durDirty = true;
});

$("dur").addEventListener("change", async () => {
  await persistDuration($("dur").value);
  durDirty = false;
});

$("btn").onclick = async () => {
  const on = $("btn").textContent === "Полить";
  const durationSec = Number($("dur").value);
  if (on) await persistDuration(durationSec);
  durDirty = false;
  await fetch("/api/relay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      on,
      durationSec: on ? durationSec : undefined,
    }),
  });
  await refresh();
};

$("add-schedule").onclick = async () => {
  await fetch("/api/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: true, days: "all", time_hm: "07:00", duration_sec: Number($("dur").value) || 60 }),
  });
  schedulesDirty = false;
  lastSchedSig = "";
  await refresh();
};

$("schedules").onclick = async (ev) => {
  const btn = ev.target.closest("button");
  if (!btn) return;
  const card = ev.target.closest(".sched");
  if (!card) return;
  const id = card.dataset.id;
  if (btn.dataset.del !== undefined) {
    await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    schedulesDirty = false;
    lastSchedSig = "";
    await refresh();
    return;
  }
  if (btn.dataset.save !== undefined) {
    const days = daysFromChecks(card);
    if (!days) {
      alert("Выберите хотя бы один день");
      return;
    }
    const res = await fetch(`/api/schedules/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: card.querySelector("[data-en]").checked,
        days,
        time_hm: card.querySelector("[data-time]").value || "07:00",
        duration_sec: Number(card.querySelector("[data-dur]").value) || 60,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "ошибка" }));
      alert(err.error || "Не сохранено");
      return;
    }
    schedulesDirty = false;
    lastSchedSig = "";
    await refresh();
  }
};

$("schedules").onchange = async (ev) => {
  const t = ev.target;
  if (!(t instanceof HTMLInputElement)) return;
  const card = t.closest(".sched");
  if (!card) return;
  if (t.dataset.day !== undefined) {
    schedulesDirty = true;
    const all = card.querySelector('[data-day="all"]');
    const rest = [...card.querySelectorAll("[data-day]:not([data-day=all])")];
    if (t.dataset.day === "all") {
      rest.forEach((el) => {
        el.checked = all.checked;
      });
    } else {
      all.checked = rest.every((el) => el.checked);
    }
    return;
  }
  if (t.dataset.en !== undefined) {
    await fetch(`/api/schedules/${card.dataset.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: t.checked }),
    });
    return;
  }
  if (t.dataset.time !== undefined || t.dataset.dur !== undefined) {
    schedulesDirty = true;
  }
};

refresh();
setInterval(refresh, 4000);
