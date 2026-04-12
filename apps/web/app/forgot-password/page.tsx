import { AuthShell } from '@/components/auth/auth-shell';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-[#0d0d10] px-6 py-10">
      <ForgotPasswordForm />
      <div className="pointer-events-none fixed bottom-0 right-0 text-[12rem] font-bold tracking-[-0.08em] text-white/[0.03]">
        RECOVERY
      </div>
    </main>
  );
}
