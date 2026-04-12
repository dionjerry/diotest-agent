import crypto from 'node:crypto';

import { InvalidResetTokenState, ResetPasswordForm } from '@/components/auth/reset-password-form';
import { prisma } from '@/lib/prisma';

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const record = await prisma.passwordResetToken.findUnique({
    where: { token: tokenHash },
    include: {
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  const isValid = Boolean(record && record.expiresAt >= new Date());

  return (
    <main className="min-h-screen bg-[#0d0d10] px-6 py-10">
      {isValid && record ? <ResetPasswordForm token={token} email={record.user.email} /> : <InvalidResetTokenState />}
    </main>
  );
}
