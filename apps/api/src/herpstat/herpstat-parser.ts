import type {Metric, ReadingInput} from '@snake/shared';

export interface ParsedUpload {
  mac?: string;
  model?: string;
  firmware?: string;
  channelLabels?: Record<string, string>;
  readings: ReadingInput[];
}

interface StatusOutput {
  outputnickname?: string;
  probereadingTEMP?: number;
  probereadingRH?: number;
  currentsetting?: number;
  poweroutput?: number;
}
interface StatusPayload {
  system: {mac: string; firmware?: string | number; numberofoutputs?: number};
  [output: `output${number}`]: StatusOutput;
}

export function parseHerpstatUpload(body: string, contentType = ''): ParsedUpload {
  const data = decode(body, contentType);
  if (data === undefined) return {readings: []};
  return isStatus(data) ? fromStatus(data) : fromFlat(data);
}

function decode(body: string, contentType: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    if (contentType.includes('form') || body.includes('=')) return Object.fromEntries(new URLSearchParams(body));
    return undefined;
  }
}

function isStatus(data: unknown): data is StatusPayload {
  const sys = (data as StatusPayload | null)?.system;
  return !!sys && typeof sys === 'object' && typeof sys.mac === 'string';
}

function fromStatus(s: StatusPayload): ParsedUpload {
  const n = s.system.numberofoutputs;
  const outputs = Object.keys(s)
    .filter(k => /^output\d+$/.test(k) && (!n || Number(k.slice(6)) <= n))
    .sort()
    .map(k => [k, s[k as `output${number}`]] as const);

  const readings: ReadingInput[] = [];
  const push = (channel: string, metric: Metric, v: unknown) => {
    const num = Number(v);
    if (v !== undefined && v !== null && v !== '' && Number.isFinite(num)) readings.push({channel, metric, value: num});
  };
  const channelLabels: Record<string, string> = {};
  for (const [ch, o] of outputs) {
    if (!o) continue;
    const name = o.outputnickname?.trim();
    if (name) channelLabels[ch] = name;
    push(ch, 'temp_f', o.probereadingTEMP);
    if (Number(o.probereadingRH) > 0) push(ch, 'humidity', o.probereadingRH);
    push(ch, 'power_pct', o.poweroutput);
    push(ch, 'setpoint_f', o.currentsetting);
  }
  return {
    mac: s.system.mac.toUpperCase(),
    model: n ? `Herpstat ${n}` : undefined,
    firmware: s.system.firmware != null ? String(s.system.firmware) : undefined,
    channelLabels,
    readings,
  };
}

function fromFlat(data: unknown): ParsedUpload {
  const flat = new Map<string, unknown>();
  const walk = (v: unknown, path: string) => {
    if (v && typeof v === 'object') {
      for (const [k, child] of Object.entries(v)) walk(child, path ? `${path}.${k}` : k);
    } else flat.set(path, v);
  };
  walk(data, '');

  const out: ParsedUpload = {readings: []};
  const seen = new Set<string>();
  for (const [key, raw] of flat) {
    const k = key.toLowerCase();
    if (/mac/.test(k) && typeof raw === 'string' && /^([0-9a-f]{2}[:-]?){6}$/i.test(raw)) out.mac = raw.toUpperCase();
    if (/(model|devicetype)/.test(k) && typeof raw === 'string') out.model = raw;

    const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
    if (!Number.isFinite(value)) continue;
    const ch = k.match(/output\D{0,3}(\d+)/) ?? k.match(/(?:^|\.)(\d+)\./);
    if (!ch) continue;
    const channel = `output${ch[1]}`;

    let metric: Metric | undefined;
    if (/(setpoint|target|set_?temp)/.test(k)) metric = 'setpoint_f';
    else if (/(power|percent|pct|duty)/.test(k)) metric = 'power_pct';
    else if (/humid/.test(k)) metric = 'humidity';
    else if (/(temp|probe)/.test(k) && !/(unit|scale|alarm|min|max|high|low)/.test(k)) metric = 'temp_f';
    if (!metric) continue;

    const celsius = /(celsius|_c$|tempc)/.test(k);
    const v = metric === 'temp_f' || metric === 'setpoint_f' ? (celsius ? (value * 9) / 5 + 32 : value) : value;
    const dedupe = `${channel}:${metric}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.readings.push({channel, metric, value: Math.round(v * 10) / 10});
  }
  return out;
}
