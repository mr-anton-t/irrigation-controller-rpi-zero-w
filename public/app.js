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
  return picked.length ? picked.join(",") : "all";
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
  $("dur").value = s.settings.duration_sec;
  $("schedules").innerHTML = (s.schedules || []).map(scheduleCard).join("") ||
    '<p class="muted">Нет расписаний</p>';
}

$("btn").onclick = async () => {
  const on = $("btn").textContent === "Полить";
  await fetch("/api/relay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      on,
      durationSec: on ? Number($("dur").value) : undefined,
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
    await refresh();
    return;
  }
  if (btn.dataset.save !== undefined) {
    await fetch(`/api/schedules/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: card.querySelector("[data-en]").checked,
        days: daysFromChecks(card),
        time_hm: card.querySelector("[data-time]").value || "07:00",
        duration_sec: Number(card.querySelector("[data-dur]").value) || 60,
      }),
    });
    await refresh();
  }
};

$("schedules").onchange = (ev) => {
  const t = ev.target;
  if (!(t instanceof HTMLInputElement) || t.dataset.day === undefined) return;
  const card = t.closest(".sched");
  const all = card.querySelector('[data-day="all"]');
  const rest = [...card.querySelectorAll("[data-day]:not([data-day=all])")];
  if (t.dataset.day === "all") {
    rest.forEach((el) => {
      el.checked = all.checked;
    });
    return;
  }
  all.checked = rest.every((el) => el.checked);
};

refresh();
setInterval(refresh, 4000);
