import { exec } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { logServerError, logServerEvent } from '@/lib/server-logger';

const execAsync = promisify(exec);

const EXTENSION_PATH = path.join(process.cwd(), 'apps', 'extension');
const DIST_PATH = path.join(process.cwd(), '.diotest-extension-build');
const ZIP_PATH = path.join(DIST_PATH, 'diotest-extension.zip');
const IGNORED_PATH_SEGMENTS = new Set(['node_modules', '.git', 'dist']);
const IGNORED_SUFFIXES = ['.DS_Store'];

function getLatestExtensionSourceMtime(dirPath: string): number {
  let latestMtime = 0;

  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    if (IGNORED_PATH_SEGMENTS.has(entry.name) || IGNORED_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const stats = statSync(fullPath);
    latestMtime = Math.max(latestMtime, stats.mtimeMs);

    if (entry.isDirectory()) {
      latestMtime = Math.max(latestMtime, getLatestExtensionSourceMtime(fullPath));
    }
  }

  return latestMtime;
}

function shouldRebuildArtifact() {
  if (!existsSync(ZIP_PATH)) {
    return true;
  }

  const zipMtime = statSync(ZIP_PATH).mtimeMs;
  const latestSourceMtime = getLatestExtensionSourceMtime(EXTENSION_PATH);
  return latestSourceMtime > zipMtime;
}

async function ensureExtensionZip(format: string) {
  mkdirSync(DIST_PATH, { recursive: true });

  if (!shouldRebuildArtifact()) {
    logServerEvent('extension.download.cache_hit', { format });
    return;
  }

  logServerEvent('extension.download.building', { format });
  await execAsync('npm run build');

  if (existsSync(ZIP_PATH)) {
    unlinkSync(ZIP_PATH);
  }

  await execAsync(
    `cd "${process.cwd()}" && zip -r -q "${ZIP_PATH}" apps/extension ` +
    `-x "*/node_modules/*" "*/.git/*" "*/dist/*" "*/.next/*" "*.DS_Store"`,
  );
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'chrome';
    await ensureExtensionZip(format);

    // Read the ZIP file
    const zipBuffer = await readFile(ZIP_PATH);

    logServerEvent('extension.download.success', {
      format,
      sizeBytes: zipBuffer.length,
      durationMs: Date.now() - startedAt,
    });

    // Return as download
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="diotest-extension-${format}.zip"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    logServerError('extension.download.error', 'internal_error', {}, error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to build extension' },
      { status: 500 },
    );
  }
}
