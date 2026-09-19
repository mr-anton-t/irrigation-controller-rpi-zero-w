let chart;

async function draw() {
  const [settings, data] = await Promise.all([
    loadSettings(),
    fetch("/api/readings").then((r) => r.json()),
  ]);
  const u = labelsFor(settings);
  const labels = data.map((p) =>
    new Date(p.ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  );
  const ctx = document.getElementById("chart");
  const grid = cssVar("--line", "#2a3732");
  const tick = cssVar("--muted", "#8aa394");
  const text = cssVar("--text", "#e8f0ea");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "T " + u.temp, data: data.map((p) => convertTemp(p.temp_c, settings.temp_unit)), borderColor: "#e07a3d", tension: 0.25, pointRadius: 0 },
        { label: "RH " + u.humidity, data: data.map((p) => convertHumidity(p.humidity, settings.humidity_unit)), borderColor: "#4aa3e0", tension: 0.25, pointRadius: 0 },
        { label: "Dew " + u.temp, data: data.map((p) => convertTemp(p.dew_point_c, settings.temp_unit)), borderColor: "#3dba7a", tension: 0.25, pointRadius: 0 },
        { label: "P " + u.pressure, data: data.map((p) => convertPressure(p.pressure_hpa, settings.pressure_unit)), borderColor: "#b07ae0", tension: 0.25, pointRadius: 0, yAxisID: "y2" }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { ticks: { maxTicksLimit: 8, color: tick }, grid: { color: grid } },
        y: { ticks: { color: tick }, grid: { color: grid } },
        y2: { position: "right", ticks: { color: tick }, grid: { drawOnChartArea: false } }
      },
      plugins: { legend: { labels: { color: text } } }
    }
  });
}
draw();
