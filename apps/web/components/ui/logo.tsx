export function LogoMark() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#53dca4] text-[0.7rem] font-bold tracking-[-0.08em] text-[#0b241a]">
      {'>_'}
    </div>
  );
}

export function LogoLockup({ subtle = false, studio = false }: { subtle?: boolean; studio?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark />
      <div>
        <div className="text-sm font-semibold text-text">{studio ? 'DioTest Studio' : 'DioTest'}</div>
        {subtle ? <div className="text-[10px] uppercase tracking-[0.18em] text-soft">Technical testing platform</div> : null}
      </div>
    </div>
  );
}
