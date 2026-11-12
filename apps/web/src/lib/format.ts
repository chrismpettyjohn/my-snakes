import type { Metric } from "@snake/shared";

export const metricLabel: Record<Metric, string> = {
  temp_f: "Temp", humidity: "Humidity", power_pct: "Power", setpoint_f: "Setpoint",
};
export const fmt = (m: Metric, v: number) =>
  m === "humidity" || m === "power_pct" ? `${Math.round(v)}%` : `${v.toFixed(1)}°F`;

export function ago(iso: string | Date | null | undefined) {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
