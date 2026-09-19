import { networkInterfaces, hostname } from "node:os";
import { config } from "./config.js";
import type { Settings } from "./db.js";

export function currentNetwork() {
  const ifaces = networkInterfaces();
  const list: { name: string; address: string; family: string; internal: boolean }[] = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const a of addrs ?? []) {
      list.push({
        name,
        address: a.address,
        family: String(a.family),
        internal: a.internal,
      });
    }
  }
  const v4 = list.find((x) => x.family === "IPv4" && !x.internal);
  return {
    hostname: hostname(),
    primary_ip: v4?.address ?? "127.0.0.1",
    interfaces: list,
    mock: config.useMock,
  };
}

/** On a real Pi this would write NetworkManager / dhcpcd. In mock we only persist settings. */
export function applyNetworkHint(s: Settings): { applied: boolean; note: string } {
  if (config.useMock) {
    return {
      applied: false,
      note: "Mock: SSID/IP/домен сохранены в БД, система не менялась.",
    };
  }
  return {
    applied: false,
    note: `Сохранено. Применить Wi‑Fi (${s.wifi_ssid || "—"}) и IP (${s.static_ip || "DHCP"}) на Pi нужно через nmcli/dhcpcd отдельно.`,
  };
}
