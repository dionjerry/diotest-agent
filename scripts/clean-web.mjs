import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const nextDir = path.join(repoRoot, 'apps', 'web', '.next');
const port = Number(process.env.PORT || 3000);

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

if (await isPortInUse(port)) {
  console.error(`Refusing to delete apps/web/.next while a dev server appears to be running on port ${port}. Stop it first, then run npm run clean:web.`);
  process.exit(1);
}

fs.rmSync(nextDir, { recursive: true, force: true });
console.log('Removed apps/web/.next');
