function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const PORT = Number(process.env.PORT ?? 3000);
export const HOST = IS_PRODUCTION ? '0.0.0.0' : '127.0.0.1';
export const API_URL = process.env.API_URL ?? 'http://localhost:3000';
export const BRIDGE_PATH = process.env.BRIDGE_PATH?.replace(/\/$/, '') || undefined;
export const WEB_URL = (process.env.WEB_URL ?? 'http://localhost:5173').replace(/\/$/, '');

const POSTGRES_HOST = process.env.POSTGRES_HOST ?? 'localhost';
const POSTGRES_PORT = process.env.POSTGRES_PORT ?? '5432';
const POSTGRES_USER = required('POSTGRES_USER');
const POSTGRES_PASS = required('POSTGRES_PASS');
const POSTGRES_NAME = required('POSTGRES_NAME');
export const DATABASE_URL = `postgres://${encodeURIComponent(POSTGRES_USER)}:${encodeURIComponent(POSTGRES_PASS)}@${POSTGRES_HOST}:${POSTGRES_PORT}/${encodeURIComponent(POSTGRES_NAME)}`;

export const JWT_SECRET = required('JWT_SECRET');
export const POSTGRES_ENCRYPTION_KEY = required('POSTGRES_ENCRYPTION_KEY');

export const DISCORD_CLIENT_ID = required('DISCORD_CLIENT_ID');
export const DISCORD_CLIENT_SECRET = required('DISCORD_CLIENT_SECRET');

if (POSTGRES_ENCRYPTION_KEY.length < 15) throw new Error('POSTGRES_ENCRYPTION_KEY must be at least 15 characters');
if (IS_PRODUCTION && [JWT_SECRET, POSTGRES_ENCRYPTION_KEY].some(v => v.startsWith('change-me'))) {
  throw new Error('JWT_SECRET and POSTGRES_ENCRYPTION_KEY must be changed from the .env.example placeholders in production');
}
