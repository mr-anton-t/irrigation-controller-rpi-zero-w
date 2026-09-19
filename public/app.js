const $ = (id) => document.getElementById(id);

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
  $("enabled").checked = s.settings.schedule_enabled;
  $("cron").value = s.settings.cron_expr;
  $("dur").value = s.settings.duration_sec;
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

$("save").onclick = async () => {
  await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schedule_enabled: $("enabled").checked,
      cron_expr: $("cron").value,
      duration_sec: Number($("dur").value),
    }),
  });
  await refresh();
};

refresh();
setInterval(refresh, 4000);
