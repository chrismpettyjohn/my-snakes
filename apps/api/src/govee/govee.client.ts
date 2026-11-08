const BASE = "https://openapi.api.govee.com/router/api/v1";

export interface GoveeDevice {
  sku: string;
  device: string;
  deviceName?: string;
  type?: string;
}

export interface GoveeSensorState { tempF?: number; humidity?: number; online?: boolean }

async function call<T>(apiKey: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Govee-API-Key": apiKey, "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { code?: number; message?: string; msg?: string } & T;
  if (!res.ok || (json.code !== undefined && json.code !== 200)) {
    throw new Error(`Govee ${path}: ${res.status} ${json.message ?? json.msg ?? ""}`.trim());
  }
  return json;
}

/**
 * A capability state value: a number, a numeric string, or an object holding the reading under
 * a known key. Unknown shapes return undefined rather than guessing at an arbitrary field.
 */
function toNumber(v: unknown): number | undefined {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    v = o.currentTemperature ?? o.currentHumidity ?? o.current ?? o.value;
  }
  if (typeof v === "string" && v.trim() === "") return undefined;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/** Official Govee Developer API (v2 "router" API). Key from Govee Home app → Profile → Settings → Apply for API Key. */
export const govee = {
  async listDevices(apiKey: string): Promise<GoveeDevice[]> {
    const r = await call<{ data: GoveeDevice[] }>(apiKey, "/user/devices");
    return r.data ?? [];
  },

  async sensorState(apiKey: string, d: GoveeDevice): Promise<GoveeSensorState> {
    const r = await call<{ payload: { capabilities: { instance: string; state: { value: unknown } }[] } }>(
      apiKey, "/device/state",
      { method: "POST", body: JSON.stringify({ requestId: crypto.randomUUID(), payload: { sku: d.sku, device: d.device } }) },
    );
    const out: GoveeSensorState = {};
    for (const c of r.payload?.capabilities ?? []) {
      const v = c.state?.value;
      // Govee reports sensorTemperature in °F; stored as-is.
      if (c.instance === "sensorTemperature") out.tempF = toNumber(v);
      if (c.instance === "sensorHumidity") out.humidity = toNumber(v);
      if (c.instance === "online") out.online = v === true || v === "true" || v === 1;
    }
    return out;
  },

  /** Thermo-hygrometers report type "devices.types.thermometer". */
  isSensor(d: GoveeDevice) {
    return d.type === "devices.types.thermometer" || d.type === "devices.types.sensor";
  },
};
