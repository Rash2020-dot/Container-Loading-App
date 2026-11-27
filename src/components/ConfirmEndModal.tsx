import { AlertTriangle } from 'lucide-react';

interface ConfirmEndModalProps {
  open: boolean;
  containerNo: string;
  shipmentNo: string;
  scannedCount: number;
  totalCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmEndModal({
  open,
  containerNo,
  shipmentNo,
  scannedCount,
  totalCount,
  onCancel,
  onConfirm,
}: ConfirmEndModalProps) {
  if (!open) return null;

  const missingCount = Math.max(0, totalCount - scannedCount);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-end-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 id="confirm-end-title" className="text-base font-semibold text-slate-900">
              End Container Loading Session?
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              This will finalize scanning for container{' '}
              <span className="font-mono font-semibold text-slate-900">{containerNo}</span>{' '}
              (Shipment <span className="font-mono font-semibold text-slate-900">{shipmentNo}</span>),
              record the monthly summary, and trigger the completion email if configured.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50 py-3 text-center">
          <div>
            <div className="text-xs text-slate-500">Expected</div>
            <div className="mt-0.5 font-mono text-base font-bold text-slate-900 tabular-nums">
              {totalCount}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Scanned</div>
            <div className="mt-0.5 font-mono text-base font-bold text-emerald-600 tabular-nums">
              {scannedCount}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Missing</div>
            <div className="mt-0.5 font-mono text-base font-bold text-red-600 tabular-nums">
              {missingCount}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 whitespace-nowrap shrink-0 cursor-pointer"
          >
            End Loading Session
          </button>
        </div>
      </div>
    </div>
  );
}
