interface ContainerTruckVisualProps {
  exactPct: number;
  displayPct: string;
  scannedCount: number;
}

export function ContainerTruckVisual({
  exactPct,
  displayPct,
  scannedCount,
}: ContainerTruckVisualProps) {
  const fillWidth =
    scannedCount > 0 && exactPct < 1 ? 3 : Math.min(100, Math.max(0, exactPct));

  return (
    <div className="mt-5">
      <div className="mb-2 flex justify-between text-[0.9em] font-bold text-[#1e293b]">
        <span>🚛 Side View Container Load Status</span>
        <span className="tabular-nums">{displayPct}%</span>
      </div>

      <div className="relative flex w-full items-end rounded-[12px] bg-[#0f172a] px-3 pt-4 pb-9 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
        {/* Truck Cab */}
        <div className="relative mr-1.5 h-[90px] w-[75px] shrink-0 rounded-tl-[12px] rounded-tr-[4px] bg-gradient-to-br from-[#dc2626] to-[#991b1b] shadow-[2px_0_8px_rgba(0,0,0,0.5)]">
          <div className="absolute top-3 left-2 h-8 w-[38px] rounded-tl-[6px] rounded-tr-[2px] rounded-br-[2px] rounded-bl-[2px] border-2 border-[#1e293b] bg-gradient-to-br from-[#38bdf8] to-[#0284c7]" />
          <div className="truck-grille-pattern absolute bottom-2.5 left-4 h-5 w-6 rounded-[2px] bg-[#334155]" />
          <div className="absolute bottom-3 left-1 h-3.5 w-2 rounded-[2px] bg-[#fef08a] shadow-[-4px_0_10px_#fef08a]" />
        </div>

        {/* Corrugated Shipping Container Body */}
        <div className="relative flex h-[95px] flex-1 items-center overflow-hidden rounded-[4px] border-[3px] border-[#475569] bg-[#1e293b] shadow-[inset_0_0_15px_rgba(0,0,0,0.9)]">
          <div className="container-corrugation pointer-events-none absolute inset-0 z-20 border-t-[3px] border-b-[3px] border-[#64748b]" />
          <div className="pointer-events-none absolute top-2 left-3 z-30 font-mono text-[11px] font-extrabold tracking-[1.5px] text-white/60">
            MSCU 482019 45G1
          </div>
          <div className="pointer-events-none absolute top-0 right-3 bottom-0 z-30 w-[3px] bg-[#94a3b8] shadow-[8px_0_0_#94a3b8]" />

          {/* Cargo Fill Progress */}
          <div
            className="relative z-10 flex h-full items-center justify-end bg-gradient-to-r from-[#2563eb] via-[#06b6d4] to-[#10b981] shadow-[3px_0_12px_rgba(6,182,212,0.8)] transition-[width] duration-400 ease-in-out"
            style={{ width: `${fillWidth}%` }}
          >
            <div className="cargo-grid-pattern absolute inset-0" />
            {fillWidth > 0 && (
              <span className="relative z-30 mr-0.5 text-[20px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                📦
              </span>
            )}
          </div>
        </div>

        {/* Chassis Beam */}
        <div className="absolute right-5 bottom-[22px] left-5 z-30 h-2 rounded-[2px] bg-[#334155]" />

        {/* Wheels */}
        <div className="pointer-events-none absolute right-0 bottom-0.5 left-0 z-40 flex h-7 justify-between px-[25px]">
          <div className="flex gap-1.5">
            <div className="relative h-[26px] w-[26px] rounded-full border-[3px] border-[#475569] bg-[#090d16] shadow-[0_4px_6px_rgba(0,0,0,0.6)]">
              <div className="absolute top-1/2 left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#1e293b] bg-[#cbd5e1]" />
            </div>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((wheel) => (
              <div
                key={wheel}
                className="relative h-[26px] w-[26px] rounded-full border-[3px] border-[#475569] bg-[#090d16] shadow-[0_4px_6px_rgba(0,0,0,0.6)]"
              >
                <div className="absolute top-1/2 left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#1e293b] bg-[#cbd5e1]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
