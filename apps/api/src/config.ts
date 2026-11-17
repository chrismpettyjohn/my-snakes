function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

export const DATABASE_URL = required('DATABASE_URL');
export const JWT_SECRET = required('JWT_SECRET');
export const SECRET_KEY = required('SECRET_KEY');
export const PUBLIC_API_URL = process.env.PUBLIC_API_URL ?? 'http://localhost:3000';
export const PORT = Number(process.env.PORT ?? 3000);
export const GOVEE_POLL_SECONDS = Number(process.env.GOVEE_POLL_SECONDS ?? 300);
export const HERPSTAT_POLL_SECONDS = Math.max(10, Number(process.env.HERPSTAT_POLL_SECONDS ?? 30));
export const READINGS_RETENTION_DAYS = Math.max(2, Number(process.env.READINGS_RETENTION_DAYS ?? 14));
export const MIGRATE_ON_BOOT = (process.env.MIGRATE_ON_BOOT ?? 'true') !== 'false';
export const HERPSTAT_SCAN_SUBNETS = (process.env.HERPSTAT_SCAN_SUBNETS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

if (SECRET_KEY.length < 32) throw new Error('SECRET_KEY must be at least 32 characters');
