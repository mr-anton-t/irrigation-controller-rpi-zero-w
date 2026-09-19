const $ = (id) => document.getElementById(id);
let currentTheme = "system";

function markTheme(theme) {
  currentTheme = theme;
  document.querySelectorAll(".seg button").forEach((b) => {
    b.classList.toggle("on", b.dataset.theme === theme);
  });
  applyTheme(theme);
  localStorage.setItem(THEME_KEY, theme);
}

async function fill() {
  const [s, net] = await Promise.all([
    loadSettings(),
    fetch("/api/network").then((r) => r.json()),
  ]);
  $("temp_unit").value = s.temp_unit;
  $("humidity_unit").value = s.humidity_unit;
  $("pressure_unit").value = s.pressure_unit;
  $("wifi_ssid").value = s.wifi_ssid;
  $("wifi_password").value = s.wifi_password;
  $("domain").value = s.domain;
  $("static_ip").value = s.static_ip;
  $("gateway").value = s.gateway;
  $("dns").value = s.dns;
  $("ntp_server").value = s.ntp_server || "pool.ntp.org";
  $("relay_gpio").value = s.relay_gpio;
  $("relay_active_low").checked = s.relay_active_low;
  $("i2c_bus").value = s.i2c_bus;
  $("bme280_address").value = String(s.bme280_address);
  $("netnow").textContent =
    `сейчас: ${net.hostname} · ${net.primary_ip}` + (net.mock ? " (mock)" : "");
  markTheme(s.theme);
}

document.querySelectorAll(".seg button").forEach((b) => {
  b.onclick = () => markTheme(b.dataset.theme);
});

$("save").onclick = async () => {
  const body = {
    temp_unit: $("temp_unit").value,
    humidity_unit: $("humidity_unit").value,
    pressure_unit: $("pressure_unit").value,
    theme: currentTheme,
    wifi_ssid: $("wifi_ssid").value,
    wifi_password: $("wifi_password").value,
    domain: $("domain").value,
    static_ip: $("static_ip").value,
    gateway: $("gateway").value,
    dns: $("dns").value,
    ntp_server: $("ntp_server").value.trim() || "pool.ntp.org",
    relay_gpio: Number($("relay_gpio").value),
    relay_active_low: $("relay_active_low").checked,
    i2c_bus: Number($("i2c_bus").value),
    bme280_address: Number($("bme280_address").value),
  };
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
  applyTheme(res.theme);
  $("toast").textContent = res.network_apply?.note || "Сохранено";
};

fill();
