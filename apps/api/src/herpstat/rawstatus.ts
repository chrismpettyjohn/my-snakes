import type { Metric, ReadingInput } from "@snake/shared";

/** Shape of GET http://<herpstat>/RAWSTATUS (SpyderWeb). Keys per yipe/herpstat + jjack exporter. */
export interface RawStatus {
  system: {
    nickname?: string; ip?: string; mac: string; firmware?: string | number;
    safetyrelay?: string; numberofoutputs?: number; powerresets?: number; internaltemp?: number;
  };
  [output: `output${number}`]: RawOutput;
}
export interface RawOutput {
  outputnickname?: string; outputmode?: string;
  probereadingTEMP?: number; probereadingTEMPMAX?: number; probereadingTEMPMIN?: number;
  probereadingRH?: number; currentsetting?: number; poweroutput?: number; poweroutputLIMIT?: number;
  ramping?: string; enablehighlowalarm?: number; highalarm?: number; lowalarm?: number;
  errorcode?: number; errorcodedescription?: string;
}

export class RawStatusDisabledError extends Error {
  constructor() { super("/RAWSTATUS is disabled: ADMIN → Show Advanced Status Integration Options → Enable /RAWSTATUS Page"); }
}

/** Fetches /RAWSTATUS. Body is JSON served as text/html and is sometimes truncated, so retry. */
export async function fetchRawStatus(host: string, attempts = 2): Promise<RawStatus> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`http://${host}/RAWSTATUS`, { signal: AbortSignal.timeout(8_000) });
      if (res.status === 501) throw new RawStatusDisabledError();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = JSON.parse(await res.text()) as RawStatus;
      if (!json?.system?.mac) throw new Error("Unexpected /RAWSTATUS payload (no system.mac)");
      return json;
    } catch (e) {
      if (e instanceof RawStatusDisabledError) throw e;
      // Units with the page disabled (or firmware without it) often just drop the connection.
      if (e instanceof Error && /closed unexpectedly|ECONNRESET|socket/i.test(e.message)) {
        e.message = "Connection dropped on /RAWSTATUS. Is it enabled in ADMIN (and is firmware ≥ 4.8)?";
      }
      last = e;
      if (i < attempts - 1) await Bun.sleep(1500);
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

export function outputs(s: RawStatus): [channel: string, o: RawOutput][] {
  const n = s.system.numberofoutputs;
  return Object.keys(s)
    .filter((k) => /^output\d+$/.test(k) && (!n || Number(k.slice(6)) <= n))
    .sort()
    .map((k) => [k, s[k as `output${number}`]]);
}

/** Output nicknames set on the unit, e.g. { output1: "Edom Bask" }. */
export function channelLabels(s: RawStatus): Record<string, string> {
  return Object.fromEntries(outputs(s).flatMap(([ch, o]) => {
    const name = o?.outputnickname?.trim();
    return name ? [[ch, name]] : [];
  }));
}

export function readingsFrom(s: RawStatus): ReadingInput[] {
  const out: ReadingInput[] = [];
  const push = (channel: string, metric: Metric, v: unknown) => {
    const n = Number(v);
    if (v !== undefined && v !== null && v !== "" && Number.isFinite(n)) out.push({ channel, metric, value: n });
  };
  for (const [ch, o] of outputs(s)) {
    if (!o) continue;
    push(ch, "temp_f", o.probereadingTEMP);
    if (Number(o.probereadingRH) > 0) push(ch, "humidity", o.probereadingRH); // 0 = no RH probe
    push(ch, "power_pct", o.poweroutput);
    push(ch, "setpoint_f", o.currentsetting);
  }
  return out;
}
