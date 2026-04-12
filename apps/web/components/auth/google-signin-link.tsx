'use client';

export function GoogleSigninLink({
  label,
  enabled,
  source,
  callbackUrl = '/app',
}: {
  label: string;
  enabled: boolean;
  source?: 'database' | 'environment' | 'none';
  callbackUrl?: string;
}) {
  if (!enabled) {
    return (
      <div className="rounded-[2px] border border-dashed border-white/8 bg-[#14151a] px-4 py-3 text-sm text-soft">
        Google OAuth is disabled until it is configured in system settings or via environment fallback.
      </div>
    );
  }

  return (
    <a
      href={`/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-[2px] border border-white/10 bg-[#f5f5f5] text-sm font-semibold text-[#1c1d20] transition hover:bg-white"
    >
      <span className="text-lg font-bold text-[#3b82f6]">G</span>
      {label}
    </a>
  );
}
