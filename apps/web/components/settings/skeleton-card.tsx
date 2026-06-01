export function SkeletonCard() {
  return (
    <div className="settings-card space-y-4 p-6">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-zinc-700/50" />
        <div className="h-6 w-48 animate-pulse rounded bg-zinc-700/50" />
        <div className="mt-2 h-4 w-full animate-pulse rounded bg-zinc-700/30" />
      </div>
      <div className="space-y-3">
        <div className="h-10 w-full animate-pulse rounded bg-zinc-700/40" />
        <div className="h-10 w-full animate-pulse rounded bg-zinc-700/40" />
      </div>
      <div className="h-9 w-32 animate-pulse rounded bg-zinc-700/50" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-zinc-800/20 p-4">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-700/50" />
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-zinc-700/50" />
          <div className="h-3 w-40 animate-pulse rounded bg-zinc-700/40" />
        </div>
      </div>
      <div className="h-9 w-24 animate-pulse rounded bg-zinc-700/50" />
    </div>
  );
}
