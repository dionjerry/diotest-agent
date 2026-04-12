type BackendUnavailableProps = {
  title?: string;
  message: string;
};

export function BackendUnavailable({
  title = 'Backend unavailable',
  message,
}: BackendUnavailableProps) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[760px] items-center justify-center px-6 py-16">
      <div className="w-full rounded-[8px] border border-[#5a2424] bg-[#1a1113] p-8 text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ff8780]">
          Temporary failure
        </div>
        <h1 className="mt-4 text-[2.2rem] font-bold tracking-[-0.05em] text-white">{title}</h1>
        <p className="mt-4 max-w-[40rem] text-base leading-7 text-[#c79f9f]">{message}</p>
        <div className="mt-8 rounded-[6px] border border-white/8 bg-black/20 px-4 py-4 text-sm text-[#d8d9dd]">
          Check that the API is running and that `DATABASE_URL` is reachable, then refresh the page.
        </div>
      </div>
    </div>
  );
}
