import crypto from 'crypto';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await auth();

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const invite = await prisma.organizationInvite.findUnique({
    where: { token: hashedToken },
    include: {
      organization: {
        select: { id: true, name: true },
      },
    },
  });

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0b0e] text-white">
        <div className="w-full max-w-md rounded-lg border border-white/6 bg-[#101115] p-6 text-center">
          <h1 className="text-xl font-semibold">Invalid or Expired Invite</h1>
          <p className="mt-2 text-sm text-[#7e8087]">This invitation is no longer valid. Please ask your organization owner to send you a new one.</p>
        </div>
      </main>
    );
  }

  if (!session) {
    const next = `/invite/${token}`;
    redirect(`/signup?next=${encodeURIComponent(next)}`);
  }

  if (!session.user?.id) {
    redirect('/login');
  }

  await prisma.$transaction(async (tx) => {
    const freshInvite = await tx.organizationInvite.findUnique({
      where: { id: invite.id },
    });

    if (!freshInvite || freshInvite.acceptedAt || freshInvite.expiresAt < new Date()) {
      return;
    }

    await tx.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: freshInvite.organizationId,
          userId: session.user.id,
        },
      },
      update: {},
      create: {
        organizationId: freshInvite.organizationId,
        userId: session.user.id,
        role: freshInvite.role,
      },
    });

    await tx.organizationInvite.update({
      where: { id: freshInvite.id },
      data: { acceptedAt: new Date() },
    });
  });

  redirect('/app');
}
