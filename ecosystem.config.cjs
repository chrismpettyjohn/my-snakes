const {join} = require('node:path');
const {homedir} = require('node:os');
const {existsSync} = require('node:fs');
const {execFileSync} = require('node:child_process');

const root = __dirname;
const logsDir = join(root, 'logs');

function resolveBun() {
  try {
    const found = execFileSync('which', ['bun'], {encoding: 'utf8'}).trim();
    if (found.length > 0) return found;
  } catch {}

  const candidates = [
    process.env.BUN_INSTALL ? join(process.env.BUN_INSTALL, 'bin', 'bun') : null,
    join(homedir(), '.bun', 'bin', 'bun'),
    '/opt/homebrew/bin/bun',
    '/usr/local/bin/bun',
  ];

  for (const candidate of candidates) {
    if (candidate !== null && existsSync(candidate)) return candidate;
  }

  return 'bun';
}

const bun = resolveBun();

function service(name, overrides) {
  return {
    name,
    exec_mode: 'fork',
    instances: 1,
    watch: false,
    autorestart: true,
    restart_delay: 1000,
    min_uptime: 5000,
    max_restarts: 20,
    kill_timeout: 15000,
    kill_signal: 'SIGINT',
    merge_logs: true,
    time: false,
    out_file: join(logsDir, `${name}.log`),
    error_file: join(logsDir, `${name}.error.log`),
    ...overrides,
    env: {
      NODE_ENV: 'development',
      FORCE_COLOR: '1',
      PATH: `${join(root, 'node_modules', '.bin')}:${process.env.PATH ?? ''}`,
      ...overrides.env,
    },
  };
}

const services = [
  {
    name: 'snake-api',
    cwd: join(root, 'apps', 'api'),
    script: bun,
    args: ['--watch', '--no-clear-screen', 'src/main.ts'],
    interpreter: 'none',
  },
  {
    name: 'snake-web',
    cwd: join(root, 'apps', 'web'),
    script: bun,
    args: ['--bun', 'run', 'vite', '--host', 'localhost'],
    interpreter: 'none',
  },
];

module.exports = {
  apps: services.map(descriptor => service(descriptor.name, descriptor)),
};
