import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const webDir = path.join(repoRoot, 'apps', 'web');
const envPath = path.join(repoRoot, '.env');
const shouldOpen = process.argv.includes('--open');
const port = Number(process.env.PORT || 3000);
const targetUrl = process.env.NEXTAUTH_URL || `http://localhost:${port}`;

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

if (!fs.existsSync(envPath)) {
  console.error('Missing repo-root .env file. Copy .env.example to .env before running npm run dev:web.');
  process.exit(1);
}

if (await isPortInUse(port)) {
  console.log(`Web dev server already appears to be running on ${targetUrl}.`);

  if (shouldOpen) {
    const openCommand =
      process.platform === 'darwin'
        ? ['open', targetUrl]
        : process.platform === 'win32'
          ? ['cmd', '/c', 'start', '', targetUrl]
          : ['xdg-open', targetUrl];

    const opener = spawn(openCommand[0], openCommand.slice(1), {
      stdio: 'ignore',
      detached: true,
    });

    opener.unref();
  }

  process.exit(0);
}

const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], {
  cwd: webDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: String(port),
  },
});

if (shouldOpen) {
  const openCommand =
    process.platform === 'darwin'
      ? ['open', targetUrl]
      : process.platform === 'win32'
        ? ['cmd', '/c', 'start', '', targetUrl]
        : ['xdg-open', targetUrl];

  setTimeout(() => {
    const opener = spawn(openCommand[0], openCommand.slice(1), {
      stdio: 'ignore',
      detached: true,
    });

    opener.unref();
  }, 2500);
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
