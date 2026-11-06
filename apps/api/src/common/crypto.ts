import { SECRET_KEY } from "../config";

// AES-256-GCM for secrets stored at rest (e.g. Govee API keys).
const enc = new TextEncoder();
let keyPromise: Promise<CryptoKey> | undefined;

function key() {
  keyPromise ??= (async () => {
    const hash = await crypto.subtle.digest("SHA-256", enc.encode(SECRET_KEY));
    return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
  })();
  return keyPromise;
}

export async function encryptSecret(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), enc.encode(plain));
  return `${Buffer.from(iv).toString("base64")}.${Buffer.from(ct).toString("base64")}`;
}

export async function decryptSecret(blob: string): Promise<string> {
  const [iv, ct] = blob.split(".");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(iv!, "base64") }, await key(), Buffer.from(ct!, "base64"),
  );
  return new TextDecoder().decode(pt);
}

export function randomToken(bytes = 24): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64url");
}
