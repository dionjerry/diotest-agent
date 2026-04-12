import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const webPort = Number(process.env.PORT || 3000);
const apiPort = Number(process.env.API_PORT || 4000);

function isPortInUse(portToCheck) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port: portToCheck, host: '127.0.0.1' });

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('error', () => {
      resolve(false);
    });
  });
}

function spawnChild(name, args, extraEnv = {}) {
  const child = spawn(npmCommand, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`${name} exited with signal ${signal}.`);
      return;
    }

    if (typeof code === 'number' && code !== 0) {
      console.error(`${name} exited with code ${code}.`);
    }
  });

  return child;
}

if (!fs.existsSync(envPath)) {
  console.error('Missing repo-root .env file. Copy .env.example to .env before running npm run dev.');
  process.exit(1);
}

const children = [];

const apiRunning = await isPortInUse(apiPort);
if (apiRunning) {
  console.log(`API dev server already appears to be running on http://localhost:${apiPort}.`);
} else {
  children.push(spawnChild('api', ['run', 'dev:api']));
}

const webRunning = await isPortInUse(webPort);
if (webRunning) {
  console.log(`Web dev server already appears to be running on http://localhost:${webPort}.`);
} else {
  children.push(spawnChild('web', ['run', 'dev:web'], { PORT: String(webPort) }));
}

if (children.length === 0) {
  console.log('Web and API dev servers are already running.');
  process.exit(0);
}

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }

  setTimeout(() => process.exit(0), 250);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

await Promise.race(
  children.map(
    (child) =>
      new Promise((resolve) => {
        child.on('exit', () => resolve());
      }),
  ),
);

shutdown('SIGTERM');
