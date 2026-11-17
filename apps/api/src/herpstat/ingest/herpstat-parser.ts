import type { Metric, ReadingInput } from "@snake/shared";

export interface ParsedUpload { mac?: string; model?: string; readings: ReadingInput[] }

/**
 * Best-effort parser for SpyderWeb "custom URL" status uploads (firmware 5.1+).
 * The payload format is undocumented: raw bodies are stored in raw_uploads so this can be
 * tightened against real data. Accepts JSON or form-encoded bodies and looks for keys like
 * `output1...temp...`, `output2...power...`, `...setpoint...`.
 */
export function parseHerpstatUpload(body: string, contentType = ""): ParsedUpload {
  const flat = new Map<string, unknown>();
  const walk = (v: unknown, path: string) => {
    if (v && typeof v === "object") {
      for (const [k, child] of Object.entries(v)) walk(child, path ? `${path}.${k}` : k);
    } else flat.set(path, v);
  };

  let data: unknown;
  try { data = JSON.parse(body); } catch {
    if (contentType.includes("form") || body.includes("=")) data = Object.fromEntries(new URLSearchParams(body));
  }
  if (data === undefined) return { readings: [] };
  walk(data, "");

  const out: ParsedUpload = { readings: [] };
  const seen = new Set<string>();
  for (const [key, raw] of flat) {
    const k = key.toLowerCase();
    if (/mac/.test(k) && typeof raw === "string" && /^([0-9a-f]{2}[:-]?){6}$/i.test(raw)) out.mac = raw.toUpperCase();
    if (/(model|devicetype)/.test(k) && typeof raw === "string") out.model = raw;

    const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (!Number.isFinite(value)) continue;
    const ch = k.match(/output\D{0,3}(\d+)/) ?? k.match(/(?:^|\.)(\d+)\./);
    if (!ch) continue;
    const channel = `output${ch[1]}`;

    let metric: Metric | undefined;
    if (/(setpoint|target|set_?temp)/.test(k)) metric = "setpoint_f";
    else if (/(power|percent|pct|duty)/.test(k)) metric = "power_pct";
    else if (/humid/.test(k)) metric = "humidity";
    else if (/(temp|probe)/.test(k) && !/(unit|scale|alarm|min|max|high|low)/.test(k)) metric = "temp_f";
    if (!metric) continue;

    const celsius = /(celsius|_c$|tempc)/.test(k);
    const v = metric === "temp_f" || metric === "setpoint_f" ? (celsius ? value * 9 / 5 + 32 : value) : value;
    const dedupe = `${channel}:${metric}`;
    if (seen.has(dedupe)) continue; // first match wins
    seen.add(dedupe);
    out.readings.push({ channel, metric, value: Math.round(v * 10) / 10 });
  }
  return out;
}
