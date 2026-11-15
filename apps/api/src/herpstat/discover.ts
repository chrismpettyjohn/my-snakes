import { networkInterfaces } from "node:os";
import { HERPSTAT_SCAN_SUBNETS } from "../config";

export interface Found { host: string; mac: string; name: string }

/**
 * Finds SpyderWeb units on the API host's local /24 networks. Only some units advertise
 * over mDNS, so instead probe "/" for the `Herpstat_<MAC>` session cookie every unit sets.
 */
export async function discoverHerpstats(): Promise<Found[]> {
  const prefixes = new Set<string>(HERPSTAT_SCAN_SUBNETS);
  if (!prefixes.size) for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal && /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(a.address)) {
        prefixes.add(a.address.split(".").slice(0, 3).join("."));
      }
    }
  }
  const hosts = [...prefixes].flatMap((p) => Array.from({ length: 254 }, (_, i) => `${p}.${i + 1}`));
  const found: Found[] = [];
  const probe = async (host: string) => {
    try {
      const res = await fetch(`http://${host}/`, { signal: AbortSignal.timeout(1500), redirect: "manual" });
      const m = (res.headers.get("set-cookie") ?? "").match(/Herpstat_([0-9A-F:]{17})=/i);
      if (!m) return;
      const name = (await res.text()).match(/\(Device: ([^)]*)\)/)?.[1] ?? "Herpstat";
      found.push({ host, mac: m[1]!.toUpperCase(), name });
    } catch { /* not a Herpstat */ }
  };
  for (let i = 0; i < hosts.length; i += 64) await Promise.all(hosts.slice(i, i + 64).map(probe));
  return found.sort((a, b) => a.name.localeCompare(b.name));
}
