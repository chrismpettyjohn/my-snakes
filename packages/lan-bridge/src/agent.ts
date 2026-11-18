import {hostname, networkInterfaces} from 'node:os';

const VERSION = 1;
const POLL_MS = 30_000;
const DISCOVER_MS = 10 * 60_000;
const DISCOVER_IDLE_MS = 2 * 60_000;
const PROBE_TIMEOUT_MS = 2_500;
const READ_TIMEOUT_MS = 8_000;
const POST_TIMEOUT_MS = 15_000;
const PROBE_CONCURRENCY = 48;
const MAX_SUBNET_HOSTS = 1024;
const MAX_STATUS_BYTES = 64_000;
const LOST_AFTER_FAILURES = 4;

const env = (name: string) => process.env[name]?.trim() || undefined;
const LOCALHOST_ALIAS = env('LOCALHOST_ALIAS');
const reachable = (url: string) => (LOCALHOST_ALIAS ? url.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/i, `$1${LOCALHOST_ALIAS}`) : url);
const API_URL = env('API_URL') && reachable(env('API_URL')!.replace(/\/$/, ''));
const TOKEN = env('BRIDGE_TOKEN');
const HOSTNAME = env('BRIDGE_HOSTNAME') ?? hostname();
const list = (v?: string) =>
  (v ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
const EXTRA_HOSTS = list(env('HERPSTAT_HOSTS'));
const SUBNETS = list(env('SCAN_SUBNETS'));

if (!API_URL || !TOKEN) {
  console.error('API_URL and BRIDGE_TOKEN are required');
  process.exit(1);
}

interface Status {
  system: {mac: string; nickname?: string; numberofoutputs?: number};
}
interface Unit {
  mac: string;
  host: string;
  nickname?: string;
  outputs?: number;
  failures: number;
  webhook?: {url: string; apiKey: string};
}

const units = new Map<string, Unit>();
const disabledHosts = new Set<string>();
let tokenRejected = false;

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const ipToInt = (ip: string) => ip.split('.').reduce((n, o) => n * 256 + Number(o), 0);
const intToIp = (n: number) => [24, 16, 8, 0].map(s => (n >>> s) & 255).join('.');
const prefixOf = (mask: string) => (mask.includes('.') ? [...ipToInt(mask).toString(2)].filter(b => b === '1').length : Number(mask));

function hostsIn(cidr: string): string[] {
  const [ip, mask = '24'] = cidr.split('/');
  if (!ip || !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return [];
  let prefix = prefixOf(mask);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return [];
  if (2 ** (32 - prefix) > MAX_SUBNET_HOSTS) prefix = 24;
  const size = 2 ** (32 - prefix);
  if (size <= 2) return [ip];
  const base = Math.floor(ipToInt(ip) / size) * size;
  return Array.from({length: size - 2}, (_, i) => intToIp(base + i + 1));
}

function localSubnets(): string[] {
  return Object.entries(networkInterfaces())
    .filter(([name]) => !/^(docker|br-|veth|lo)/.test(name))
    .flatMap(([, addrs]) => addrs ?? [])
    .filter(a => a.family === 'IPv4' && !a.internal && a.cidr)
    .map(a => a.cidr!);
}

async function readStatus(host: string, timeoutMs: number): Promise<{text: string; status: Status} | 'disabled' | null> {
  try {
    const res = await fetch(`http://${host}/RAWSTATUS`, {signal: AbortSignal.timeout(timeoutMs)});
    if (res.status === 501) return 'disabled';
    if (!res.ok || Number(res.headers.get('content-length') ?? 0) > MAX_STATUS_BYTES) return null;
    const text = await res.text();
    const status = JSON.parse(text) as Status;
    return typeof status?.system?.mac === 'string' ? {text, status} : null;
  } catch {
    return null;
  }
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({length: Math.min(size, items.length)}, async () => {
      while (i < items.length) await fn(items[i++]!);
    }),
  );
}

function remember(host: string, s: Status) {
  const mac = s.system.mac.toUpperCase();
  const prev = units.get(mac);
  if (!prev) log(`Found Herpstat ${mac} (${s.system.nickname ?? 'no nickname'}) at ${host}`);
  else if (prev.host !== host) log(`Herpstat ${mac} moved ${prev.host} → ${host}`);
  for (const u of units.values()) if (u.mac !== mac && u.host === host) u.failures = LOST_AFTER_FAILURES;
  units.set(mac, {...prev, mac, host, nickname: s.system.nickname?.trim() || undefined, outputs: s.system.numberofoutputs, failures: 0});
}

async function discover() {
  const healthy = new Set([...units.values()].filter(u => u.failures === 0).map(u => u.host));
  const subnets = SUBNETS.length ? SUBNETS : localSubnets();
  const targets = [...new Set([...EXTRA_HOSTS, ...subnets.flatMap(hostsIn)])].filter(h => !healthy.has(h));
  log(`Scanning ${targets.length} addresses on ${subnets.join(', ') || 'no subnets'}${EXTRA_HOSTS.length ? ` + ${EXTRA_HOSTS.join(', ')}` : ''}`);
  await pool(targets, PROBE_CONCURRENCY, async host => {
    const r = await readStatus(host, PROBE_TIMEOUT_MS);
    if (r === 'disabled') {
      if (!disabledHosts.has(host))
        log(`${host} has /RAWSTATUS disabled. On the Herpstat: ADMIN → Show Advanced Status Integration Options → Enable /RAWSTATUS Page`);
      disabledHosts.add(host);
    } else if (r) {
      disabledHosts.delete(host);
      remember(host, r.status);
    }
  });
  log(`${units.size} Herpstat${units.size === 1 ? '' : 's'} known`);
}

async function sync() {
  const res = await fetch(`${API_URL}/bridge/sync`, {
    method: 'POST',
    headers: {authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json'},
    body: JSON.stringify({
      hostname: HOSTNAME,
      version: VERSION,
      herpstats: [...units.values()].map(({mac, host, nickname, outputs}) => ({mac, host, nickname, outputs})),
    }),
    signal: AbortSignal.timeout(POST_TIMEOUT_MS),
  });
  if (res.status === 401) {
    if (!tokenRejected) log('Bridge token was rejected. It may have been removed in Settings. Reinstall with a new token.');
    tokenRejected = true;
    return;
  }
  if (!res.ok) throw new Error(`sync failed: HTTP ${res.status} ${await res.text().catch(() => '')}`.trim());
  tokenRejected = false;
  const body = (await res.json()) as {herpstats: {mac: string; name: string; webhook: {url: string; apiKey: string}}[]};
  for (const h of body.herpstats) {
    const u = units.get(h.mac);
    if (!u) continue;
    if (u.webhook?.url !== h.webhook.url) log(`${h.mac} → "${h.name}"`);
    u.webhook = {url: reachable(h.webhook.url), apiKey: h.webhook.apiKey};
  }
}

async function poll(): Promise<{resync: boolean; rediscover: boolean}> {
  let resync = false;
  let rediscover = false;
  await Promise.all(
    [...units.values()].map(async u => {
      const r = await readStatus(u.host, READ_TIMEOUT_MS);
      if (!r || r === 'disabled') {
        u.failures++;
        if (u.failures === LOST_AFTER_FAILURES) {
          log(`Lost Herpstat ${u.mac} at ${u.host}${r === 'disabled' ? ' (/RAWSTATUS disabled)' : ''}; rescanning`);
          rediscover = true;
        }
        return;
      }
      if (r.status.system.mac.toUpperCase() !== u.mac) {
        remember(u.host, r.status);
        rediscover = resync = true;
        return;
      }
      if (u.failures >= LOST_AFTER_FAILURES) log(`Herpstat ${u.mac} is back at ${u.host}`);
      u.failures = 0;
      if (!u.webhook) {
        resync = true;
        return;
      }
      try {
        const res = await fetch(u.webhook.url, {
          method: 'POST',
          headers: {'content-type': 'application/json', 'x-api-key': u.webhook.apiKey},
          body: r.text,
          signal: AbortSignal.timeout(POST_TIMEOUT_MS),
        });
        if (res.status === 401 || res.status === 404) {
          u.webhook = undefined;
          resync = true;
        } else if (!res.ok) log(`Webhook for ${u.mac} returned HTTP ${res.status}`);
      } catch (e) {
        log(`Webhook for ${u.mac} failed: ${errMsg(e)}`);
      }
    }),
  );
  return {resync, rediscover};
}

log(`Snake bridge v${VERSION} on ${HOSTNAME} → ${API_URL}`);
let nextDiscover = 0;
let needSync = true;
for (;;) {
  const started = Date.now();
  try {
    if (started >= nextDiscover) {
      await discover();
      nextDiscover = Date.now() + (units.size ? DISCOVER_MS : DISCOVER_IDLE_MS);
      needSync = true;
    }
    if (needSync) {
      await sync();
      needSync = false;
    }
    const r = await poll();
    if (r.rediscover) nextDiscover = 0;
    if (r.resync) needSync = true;
  } catch (e) {
    log(errMsg(e));
  }
  await Bun.sleep(Math.max(1_000, POLL_MS - (Date.now() - started)));
}
