import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // id is the extension's screenshot UUID — stored as stepId
  const screenshot = await prisma.recorderScreenshot.findFirst({
    where: { stepId: id },
    select: { data: true, mimeType: true },
  });

  if (!screenshot) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return new Response(screenshot.data, {
    headers: {
      'Content-Type': screenshot.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
