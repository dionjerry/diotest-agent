import { exec } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import { NextResponse } from 'next/server';

import { logServerError, logServerEvent } from '@/lib/server-logger';

const execAsync = promisify(exec);

const EXTENSION_PATH = path.join(process.cwd(), 'apps', 'extension');
const DIST_PATH = path.join(process.cwd(), '.diotest-extension-build');
const ZIP_PATH = path.join(DIST_PATH, 'diotest-extension.zip');

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'chrome';

    // Build the extension
    logServerEvent('extension.download.building', { format });
    await execAsync('npm run build');

    // Clean up old ZIP if it exists
    if (existsSync(ZIP_PATH)) {
      unlinkSync(ZIP_PATH);
    }

    // Create ZIP of the extension folder (excluding node_modules, .git, etc.)
    await execAsync(
      `cd "${process.cwd()}" && zip -r -q "${ZIP_PATH}" apps/extension ` +
      `-x "*/node_modules/*" "*/.git/*" "*/dist/*" "*/.next/*" "*.DS_Store"`,
    );

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
