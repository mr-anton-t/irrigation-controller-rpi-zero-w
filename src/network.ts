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

export function applyNetworkHint(s: Settings): { applied: boolean; note: string } {
  if (config.useMock) {
    return {
      applied: false,
      note: "Mock: SSID/IP/domain saved in DB, OS unchanged.",
    };
  }
  return {
    applied: false,
    note: `Saved. Apply Wi-Fi (${s.wifi_ssid || "-"}) and IP (${s.static_ip || "DHCP"}) on Pi via nmcli/dhcpcd separately.`,
  };
}
