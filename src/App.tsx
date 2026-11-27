import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { ConfirmEndModal } from './components/ConfirmEndModal';
import { ContainerTruckVisual } from './components/ContainerTruckVisual';
import type {
  AlertMessage,
  AlertTone,
  HandlingUnitItem,
  ScanLogEntry,
  ScanStatus,
  SessionPhase,
  SessionSummaryRecord,
} from './types/loading';
import { playScanBeep } from './utils/audio';
import {
  exportMonthlyExcel,
  exportSessionExcel,
  formatClockTime,
  formatDateISO,
  formatDateTime,
  formatDuration,
  parseMasterPackingList,
  saveMonthlySummary,
} from './utils/excel';

const MONTH_OPTIONS = [
  { val: '01', name: '01 - January' },
  { val: '02', name: '02 - February' },
  { val: '03', name: '03 - March' },
  { val: '04', name: '04 - April' },
  { val: '05', name: '05 - May' },
  { val: '06', name: '06 - June' },
  { val: '07', name: '07 - July' },
  { val: '08', name: '08 - August' },
  { val: '09', name: '09 - September' },
  { val: '10', name: '10 - October' },
  { val: '11', name: '11 - November' },
  { val: '12', name: '12 - December' },
];

export default function App() {
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

  const yearOptions = useMemo(() => {
    const years: string[] = [];
    for (let y = currentYear - 2; y <= currentYear + 3; y++) {
      years.push(String(y));
    }
    return years;
  }, [currentYear]);

  // Setup fields
  const [containerNo, setContainerNo] = useState('');
  const [shipmentNo, setShipmentNo] = useState('');
  const [masterStatusText, setMasterStatusText] = useState('');
  const [masterErrorText, setMasterErrorText] = useState('');
  const [masterHUMap, setMasterHUMap] = useState<Map<string, HandlingUnitItem>>(() => new Map());
  const [billingDocMap, setBillingDocMap] = useState<Map<string, HandlingUnitItem[]>>(
    () => new Map()
  );

  // Special box quantities
  const [polyBags, setPolyBags] = useState(0);
  const [doubleHeight, setDoubleHeight] = useState(0);
  const [longBoxes, setLongBoxes] = useState(0);

  // Session state
  const [phase, setPhase] = useState<SessionPhase>('idle');
  const [scannedSet, setScannedSet] = useState<Set<string>>(() => new Set());
  const [scanHistory, setScanHistory] = useState<ScanLogEntry[]>([]);
  const [scanInputValue, setScanInputValue] = useState('');
  const [lastScannedItem, setLastScannedItem] = useState<HandlingUnitItem | null>(null);
  const [alertMessage, setAlertMessage] = useState<AlertMessage | null>(null);

  // Timers
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [pauseStartedAt, setPauseStartedAt] = useState<number | null>(null);
  const [accumulatedHoldMs, setAccumulatedHoldMs] = useState(0);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // Search & Reports
  const [billingSearch, setBillingSearch] = useState('');
  const [exportYear, setExportYear] = useState(String(currentYear));
  const [exportMonth, setExportMonth] = useState(currentMonth);
  const [monthlyExportFeedback, setMonthlyExportFeedback] = useState('');
  const [showEndModal, setShowEndModal] = useState(false);

  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const alertTimerRef = useRef<number | null>(null);

  // Live 1-second timer matching original behavior (updates when active and not paused)
  useEffect(() => {
    if (phase !== 'active') return;
    const id = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    return () => {
      if (alertTimerRef.current !== null) {
        window.clearTimeout(alertTimerRef.current);
      }
    };
  }, []);

  const showAlert = (tone: AlertTone, title: string, autoHide = false) => {
    if (alertTimerRef.current !== null) {
      window.clearTimeout(alertTimerRef.current);
      alertTimerRef.current = null;
    }
    const id = Date.now();
    setAlertMessage({ id, tone, title });
    if (autoHide) {
      alertTimerRef.current = window.setTimeout(() => {
        setAlertMessage((prev) => (prev && prev.id === id ? null : prev));
      }, 2500);
    }
  };

  // Derived stats
  const totalCartons = masterHUMap.size;
  const scannedCartons = scannedSet.size;
  const remainingCartons = Math.max(0, totalCartons - scannedCartons);
  const exactPct = totalCartons > 0 ? (scannedCartons / totalCartons) * 100 : 0;
  const displayPct =
    exactPct > 0 && exactPct < 10 ? exactPct.toFixed(1) : String(Math.round(exactPct));

  const missingItems = useMemo(() => {
    const list: HandlingUnitItem[] = [];
    masterHUMap.forEach((val, hu) => {
      if (!scannedSet.has(hu)) {
        list.push(val);
      }
    });
    return list;
  }, [masterHUMap, scannedSet]);

  const elapsedMs = useMemo(() => {
    if (!startTime) return 0;
    const refEnd = endTime ? endTime.getTime() : nowTick;
    return Math.max(0, refEnd - startTime.getTime());
  }, [startTime, endTime, nowTick]);

  const canStart =
    phase === 'idle' &&
    totalCartons > 0 &&
    containerNo.trim().length > 0 &&
    shipmentNo.trim().length > 0;

  const isSessionActive = phase === 'active' || phase === 'paused' || phase === 'locked';

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMasterErrorText('');
    setMasterStatusText('');

    try {
      const parsed = await parseMasterPackingList(file);
      setMasterHUMap(parsed.huMap);
      setBillingDocMap(parsed.billingDocMap);
      setScannedSet(new Set());
      setScanHistory([]);
      setLastScannedItem(null);
      setMasterStatusText(
        `✅ Loaded: ${parsed.huMap.size.toLocaleString()} Boxes / Handling Units expected.`
      );
    } catch (err) {
      setMasterHUMap(new Map());
      setBillingDocMap(new Map());
      setMasterErrorText(
        err instanceof Error ? err.message : 'Excel file is empty or missing data!'
      );
    }
  };

  const startLoading = () => {
    if (!canStart) return;
    const now = new Date();
    setStartTime(now);
    setEndTime(null);
    setAccumulatedHoldMs(0);
    setPauseStartedAt(null);
    setNowTick(now.getTime());
    setPhase('active');

    showAlert('green', 'Started! Please scan Handling Units (Boxes).', true);
    window.setTimeout(() => scanInputRef.current?.focus(), 40);

    fetch('/api/send-start-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        container_no: containerNo.trim(),
        shipment_no: shipmentNo.trim(),
        start_time: formatDateTime(now),
        total_boxes: totalCartons,
      }),
    }).catch(() => {});
  };

  const togglePause = () => {
    if (phase === 'active') {
      setPauseStartedAt(Date.now());
      setPhase('paused');
      showAlert('yellow', '⏸️ Loading Paused. Check pending/missing HU list below.');
    } else if (phase === 'paused') {
      if (pauseStartedAt !== null) {
        setAccumulatedHoldMs((prev) => prev + Math.max(0, Date.now() - pauseStartedAt));
        setPauseStartedAt(null);
      }
      setNowTick(Date.now());
      setPhase('active');
      showAlert('green', '▶️ Resumed! You can scan now.', true);
      window.setTimeout(() => scanInputRef.current?.focus(), 40);
    }
  };

  const resumeFromError = () => {
    if (phase !== 'locked') return;
    if (pauseStartedAt !== null) {
      setAccumulatedHoldMs((prev) => prev + Math.max(0, Date.now() - pauseStartedAt));
      setPauseStartedAt(null);
    }
    setNowTick(Date.now());
    setPhase('active');
    setScanInputValue('');
    setAlertMessage(null);
    window.setTimeout(() => scanInputRef.current?.focus(), 40);
  };

  const processScan = (rawHu: string) => {
    const huNumber = rawHu.trim();
    if (!huNumber) return;

    const time = formatClockTime(new Date());
    const huData = masterHUMap.get(huNumber);
    let status: ScanStatus = 'OK';

    if (!huData) {
      status = 'NOT IN MASTER LIST';
      showAlert('red', `⛔ ALERT: Handling Unit "${huNumber}" Master List එකේ නැත!`);
      playScanBeep('red');
      setLastScannedItem(null);
      setPauseStartedAt((prev) => prev ?? Date.now());
      setPhase('locked');
    } else if (scannedSet.has(huNumber)) {
      status = 'DUPLICATE';
      showAlert('yellow', `⚠️ DUPLICATE: Handling Unit "${huNumber}" දෙපාරක් Scan වී ඇත!`);
      playScanBeep('yellow');
      setLastScannedItem(huData);
      setPauseStartedAt((prev) => prev ?? Date.now());
      setPhase('locked');
    } else {
      status = 'OK';
      setScannedSet((prev) => {
        const next = new Set(prev);
        next.add(huNumber);
        return next;
      });
      showAlert('green', `✅ SUCCESS: Handling Unit "${huNumber}" සාර්ථකව Scan විය.`, true);
      playScanBeep('green');
      setLastScannedItem(huData);
    }

    setScanHistory((prev) => [
      {
        no: prev.length + 1,
        handlingUnit: huNumber,
        billingDoc: huData ? huData.billingDoc : '-',
        material: huData ? huData.material : '-',
        description: huData ? huData.description : '-',
        time,
        status,
      },
      ...prev,
    ]);
  };

  const handleScanKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (phase !== 'active') {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!scanInputValue.trim()) return;
      processScan(scanInputValue);
      setScanInputValue('');
    }
  };

  const getSummaryData = (finalEnd: Date, finalHoldMs: number): SessionSummaryRecord => {
    const startStr = startTime ? formatClockTime(startTime) : 'N/A';
    const endStr = formatClockTime(finalEnd);
    const totalDurationMs = startTime ? Math.max(0, finalEnd.getTime() - startTime.getTime()) : 0;
    const processTimeMs = Math.max(0, totalDurationMs - finalHoldMs);

    return {
      Date: formatDateISO(finalEnd),
      'Container No': containerNo.trim(),
      'Shipment No': shipmentNo.trim(),
      'Start Time': startStr,
      'End Time': endStr,
      'Process Time': startTime ? formatDuration(processTimeMs) : 'N/A',
      'Break Time': formatDuration(finalHoldMs),
      'Expected Boxes': totalCartons,
      'Scanned Boxes': scannedCartons,
      'Missing Boxes': remainingCartons,
      'Poly Bags': polyBags,
      'Double Height Boxes': doubleHeight,
      'Long Boxes': longBoxes,
    };
  };

  const confirmEndLoading = () => {
    setShowEndModal(false);
    const now = new Date();
    const finalHoldMs =
      pauseStartedAt !== null
        ? accumulatedHoldMs + Math.max(0, now.getTime() - pauseStartedAt)
        : accumulatedHoldMs;

    setAccumulatedHoldMs(finalHoldMs);
    setPauseStartedAt(null);
    setEndTime(now);
    setNowTick(now.getTime());
    setPhase('completed');

    const summary = getSummaryData(now, finalHoldMs);
    saveMonthlySummary(summary);

    let missingTextFormatted = '';
    if (missingItems.length === 0) {
      missingTextFormatted = '🎉 All boxes scanned successfully! (No missing items)';
    } else {
      missingTextFormatted = missingItems
        .slice(0, 50)
        .map(
          (item, idx) =>
            `${idx + 1}. HU: ${item.hu} | Bill Doc: ${item.billingDoc} | Mat: ${item.material}`
        )
        .join('\n');
      if (missingItems.length > 50) {
        missingTextFormatted += `\n⚠️ ...and ${missingItems.length - 50} more missing items.\n(Please download the full Excel report from dashboard to see all items.)`;
      }
    }

    const totalDurationMs = startTime ? Math.max(0, now.getTime() - startTime.getTime()) : 0;
    const processTimeMs = Math.max(0, totalDurationMs - finalHoldMs);

    showAlert('green', '🎉 Session Ended! Summary Process Completed.');

    fetch('/api/send-end-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        container_no: containerNo.trim(),
        shipment_no: shipmentNo.trim(),
        start_time: startTime ? formatClockTime(startTime) : 'N/A',
        end_time: formatClockTime(now),
        process_time: formatDuration(processTimeMs),
        break_time: formatDuration(finalHoldMs),
        total_time: formatDuration(totalDurationMs),
        total_boxes: totalCartons,
        scanned_boxes: scannedCartons,
        missing_boxes: remainingCartons,
        poly_bags: polyBags,
        double_height_boxes: doubleHeight,
        long_boxes: longBoxes,
        progress: totalCartons > 0 ? ((scannedCartons / totalCartons) * 100).toFixed(1) : '0',
        missing_list_text: missingTextFormatted,
      }),
    })
      .then((res) => res.json())
      .then((data: { success?: boolean }) => {
        if (data.success) {
          showAlert('green', '🎉 Session Completed! Summary Email Sent Successfully.');
        }
      })
      .catch(() => {});
  };

  const handleExportSessionReport = async () => {
    const activeHold =
      pauseStartedAt !== null
        ? accumulatedHoldMs + Math.max(0, Date.now() - pauseStartedAt)
        : accumulatedHoldMs;
    const summary = getSummaryData(endTime ?? new Date(), activeHold);
    await exportSessionExcel(summary, scanHistory, missingItems, shipmentNo.trim());
  };

  const handleExportMonthlyReport = async () => {
    const count = await exportMonthlyExcel(exportYear, exportMonth);
    if (count === 0) {
      setMonthlyExportFeedback(
        `No completed shipments found for ${exportYear}-${exportMonth}.`
      );
    } else {
      setMonthlyExportFeedback('');
    }
  };

  // Billing Doc live matches
  const billingMatches = useMemo(() => {
    const query = billingSearch.trim().toLowerCase();
    if (!query) return [];
    const results: Array<{ billingDoc: string; item: HandlingUnitItem; isScanned: boolean }> = [];
    billingDocMap.forEach((hus, bDoc) => {
      if (bDoc.toLowerCase().includes(query)) {
        hus.forEach((huObj) => {
          results.push({
            billingDoc: bDoc,
            item: huObj,
            isScanned: scannedSet.has(huObj.hu),
          });
        });
      }
    });
    return results;
  }, [billingSearch, billingDocMap, scannedSet]);

  const displayHistory = scanHistory.slice(0, 50);

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-6 text-[#0f172a]">
      <div className="mx-auto max-w-[1280px] rounded-[16px] border border-[#e2e8f0] bg-white p-8 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)]">
        {/* Header */}
        <div className="mb-7 border-b-2 border-dashed border-[#e2e8f0] pb-5 text-center">
          <h1 className="m-0 flex items-center justify-center gap-2.5 text-[2.2em] font-extrabold tracking-[-0.02em] text-[#1e293b]">
            🚚 Finished Goods Container Loading Dashboard
          </h1>
          <p className="mt-1.5 mb-0 text-[0.95em] font-medium text-[#64748b]">
            Shipment &amp; Carton Verification System
          </p>
        </div>

        {/* 2-Column Grid Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left Column: 1. Shipment Setup & Controls */}
          <div className="rounded-[10px] border border-[#cbd5e1] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="mb-[18px] flex items-center justify-between border-b border-[#e2e8f0] pb-3 text-[1.1em] font-bold tracking-[-0.01em] text-[#2563eb]">
              1. Shipment Setup &amp; Controls
            </div>

            <div className="mb-3.5">
              <label
                htmlFor="containerNo"
                className="mb-1.5 block text-[0.88em] font-semibold text-[#334155]"
              >
                Container Number:
              </label>
              <input
                id="containerNo"
                type="text"
                value={containerNo}
                onChange={(e) => setContainerNo(e.target.value)}
                disabled={phase !== 'idle'}
                placeholder="e.g., CONT1234567"
                className="w-full rounded-[6px] border border-[#cbd5e1] bg-[#f8fafc] px-3.5 py-[11px] text-[14px] text-[#0f172a] transition-all focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)] focus:outline-none disabled:opacity-60"
              />
            </div>

            <div className="mb-3.5">
              <label
                htmlFor="shipmentNo"
                className="mb-1.5 block text-[0.88em] font-semibold text-[#334155]"
              >
                Shipment Number:
              </label>
              <input
                id="shipmentNo"
                type="text"
                value={shipmentNo}
                onChange={(e) => setShipmentNo(e.target.value)}
                disabled={phase !== 'idle'}
                placeholder="e.g., SHIP21062290"
                className="w-full rounded-[6px] border border-[#cbd5e1] bg-[#f8fafc] px-3.5 py-[11px] text-[14px] text-[#0f172a] transition-all focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)] focus:outline-none disabled:opacity-60"
              />
            </div>

            <div className="mb-3.5">
              <label
                htmlFor="masterFile"
                className="mb-1.5 block text-[0.88em] font-semibold text-[#334155]"
              >
                Upload Master Packing List (Excel):
              </label>
              <input
                id="masterFile"
                type="file"
                accept=".xlsx"
                disabled={phase !== 'idle'}
                onChange={handleFileUpload}
                className="w-full rounded-[6px] border border-[#cbd5e1] bg-[#f8fafc] px-3.5 py-[9px] text-[14px] text-[#0f172a] file:mr-3 file:rounded file:border-0 file:bg-[#e2e8f0] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[#1e293b] focus:border-[#2563eb] focus:bg-white focus:outline-none disabled:opacity-60"
              />
              {masterStatusText && (
                <div className="mt-2 text-[0.9em] font-bold text-[#059669]">
                  {masterStatusText}
                </div>
              )}
              {masterErrorText && (
                <div className="mt-2 text-[0.9em] font-bold text-[#ef4444]">
                  ⚠️ {masterErrorText}
                </div>
              )}
            </div>

            <div className="mt-[18px] flex flex-wrap items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={startLoading}
                disabled={!canStart}
                className="cursor-pointer rounded-[6px] border-0 bg-[#2563eb] px-[18px] py-2.5 text-[14px] font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:not-disabled:-translate-y-px hover:not-disabled:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Loading
              </button>
              <button
                type="button"
                onClick={togglePause}
                disabled={phase !== 'active' && phase !== 'paused'}
                className={`cursor-pointer rounded-[6px] border-0 px-[18px] py-2.5 text-[14px] font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:not-disabled:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${
                  phase === 'paused'
                    ? 'bg-[#06b6d4] hover:not-disabled:bg-[#0891b2]'
                    : 'bg-[#f59e0b] hover:not-disabled:bg-[#d97706]'
                }`}
              >
                {phase === 'paused' ? '▶️ Resume Loading' : 'Pause Loading'}
              </button>
              <button
                type="button"
                onClick={() => setShowEndModal(true)}
                disabled={!isSessionActive}
                className="cursor-pointer rounded-[6px] border-0 bg-[#ef4444] px-[18px] py-2.5 text-[14px] font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:not-disabled:-translate-y-px hover:not-disabled:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-50"
              >
                End Loading
              </button>
            </div>

            {/* Timer Display */}
            <div className="mt-[18px] rounded-[10px] border-2 border-[#fecaca] bg-[#fef2f2] p-3.5 text-center text-[2em] font-extrabold tracking-[0.05em] text-[#ef4444] tabular-nums">
              {formatDuration(elapsedMs)}
            </div>

            {/* Special Box Quantities Section */}
            <div className="mt-[18px] grid grid-cols-3 gap-3 rounded-[10px] border border-[#cbd5e1] bg-[#f8fafc] p-4">
              <div>
                <label
                  htmlFor="polyBagsCount"
                  className="mb-1.5 block text-[0.82em] font-semibold text-[#334155]"
                >
                  Poly Bags:
                </label>
                <input
                  id="polyBagsCount"
                  type="number"
                  min={0}
                  value={polyBags}
                  onChange={(e) => setPolyBags(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-[6px] border border-[#cbd5e1] bg-white px-3 py-2 text-[14px] text-[#0f172a] tabular-nums focus:border-[#2563eb] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="doubleHeightCount"
                  className="mb-1.5 block text-[0.82em] font-semibold text-[#334155]"
                >
                  Double Height:
                </label>
                <input
                  id="doubleHeightCount"
                  type="number"
                  min={0}
                  value={doubleHeight}
                  onChange={(e) => setDoubleHeight(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-[6px] border border-[#cbd5e1] bg-white px-3 py-2 text-[14px] text-[#0f172a] tabular-nums focus:border-[#2563eb] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="longBoxesCount"
                  className="mb-1.5 block text-[0.82em] font-semibold text-[#334155]"
                >
                  Long Boxes:
                </label>
                <input
                  id="longBoxesCount"
                  type="number"
                  min={0}
                  value={longBoxes}
                  onChange={(e) => setLongBoxes(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-[6px] border border-[#cbd5e1] bg-white px-3 py-2 text-[14px] text-[#0f172a] tabular-nums focus:border-[#2563eb] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Right Column: 2. Live Scanning Area */}
          <div className="rounded-[10px] border border-[#cbd5e1] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="mb-[18px] flex items-center justify-between border-b border-[#e2e8f0] pb-3 text-[1.1em] font-bold tracking-[-0.01em] text-[#2563eb]">
              2. Live Scanning Area
            </div>

            <input
              ref={scanInputRef}
              id="scanInput"
              type="text"
              value={scanInputValue}
              onChange={(e) => setScanInputValue(e.target.value)}
              onKeyDown={handleScanKeyDown}
              disabled={phase !== 'active'}
              placeholder={
                phase === 'paused'
                  ? 'PAUSED - Click Resume to continue'
                  : phase === 'locked'
                    ? 'SYSTEM LOCKED - CLEAR ERROR TO CONTINUE'
                    : phase === 'completed'
                      ? 'Session Completed'
                      : 'Scan Handling Unit Number Here...'
              }
              className={`w-full rounded-[10px] border-2 p-[18px] text-center text-[22px] font-bold transition-all focus:outline-none ${
                phase === 'locked'
                  ? 'border-[#ef4444] bg-[#fef2f2] text-[#ef4444] placeholder:text-[#ef4444]'
                  : 'border-[#2563eb] bg-[#eff6ff] text-[#0f172a] focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_4px_rgba(37,99,235,0.2)] disabled:opacity-75'
              }`}
            />

            {phase === 'locked' && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={resumeFromError}
                  className="animate-resume-pulse w-full cursor-pointer rounded-[10px] border-0 bg-[#ef4444] p-3.5 text-[15px] font-bold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]"
                >
                  ⚠️ ERROR DETECTED! CLICK HERE TO RESUME SCANNING
                </button>
              </div>
            )}

            {/* 4 Stat Boxes */}
            <div className="mt-[18px] grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-[10px] border border-[#cbd5e1] bg-[#f8fafc] px-2 py-3.5 text-center">
                <div className="text-[0.78em] font-bold tracking-[0.03em] text-[#64748b] uppercase">
                  Total Boxes
                </div>
                <div className="mt-1 text-[1.7em] font-extrabold tracking-[-0.02em] text-[#2563eb] tabular-nums">
                  {totalCartons}
                </div>
              </div>
              <div className="rounded-[10px] border border-[#cbd5e1] bg-[#f8fafc] px-2 py-3.5 text-center">
                <div className="text-[0.78em] font-bold tracking-[0.03em] text-[#64748b] uppercase">
                  Scanned Boxes
                </div>
                <div className="mt-1 text-[1.7em] font-extrabold tracking-[-0.02em] text-[#10b981] tabular-nums">
                  {scannedCartons}
                </div>
              </div>
              <div className="rounded-[10px] border border-[#cbd5e1] bg-[#f8fafc] px-2 py-3.5 text-center">
                <div className="text-[0.78em] font-bold tracking-[0.03em] text-[#64748b] uppercase">
                  Remaining Boxes
                </div>
                <div className="mt-1 text-[1.7em] font-extrabold tracking-[-0.02em] text-[#ef4444] tabular-nums">
                  {remainingCartons}
                </div>
              </div>
              <div className="rounded-[10px] border border-[#cbd5e1] bg-[#f8fafc] px-2 py-3.5 text-center">
                <div className="text-[0.78em] font-bold tracking-[0.03em] text-[#64748b] uppercase">
                  Progress
                </div>
                <div className="mt-1 text-[1.7em] font-extrabold tracking-[-0.02em] text-[#06b6d4] tabular-nums">
                  {displayPct}%
                </div>
              </div>
            </div>

            {/* Side-View Truck Progress */}
            <ContainerTruckVisual
              exactPct={exactPct}
              displayPct={displayPct}
              scannedCount={scannedCartons}
            />

            {/* Alert Container */}
            <div className="mt-3.5 min-h-[52px]">
              {alertMessage && (
                <div
                  className={`rounded-[10px] p-3.5 text-center text-[15px] font-bold ${
                    alertMessage.tone === 'red'
                      ? 'animate-alert-blink border-2 border-[#ef4444] bg-[#fef2f2] text-[#ef4444]'
                      : alertMessage.tone === 'yellow'
                        ? 'border-2 border-[#f59e0b] bg-[#fffbeb] text-[#b45309]'
                        : 'border-2 border-[#a7f3d0] bg-[#ecfdf5] text-[#047857]'
                  }`}
                >
                  {alertMessage.title}
                </div>
              )}
            </div>

            {/* Box Info Card */}
            {lastScannedItem && (
              <div className="mt-3.5 rounded-[10px] border border-[#bae6fd] bg-[#f0f9ff] p-4">
                <h4 className="mb-2.5 text-[1em] font-bold text-[#0369a1]">
                  📦 HU: {lastScannedItem.hu}
                </h4>
                <div className="grid grid-cols-2 gap-2.5 text-[0.88em] text-[#1e293b]">
                  <div>
                    <b>Billing Doc:</b> {lastScannedItem.billingDoc}
                  </div>
                  <div>
                    <b>Material:</b> {lastScannedItem.material}
                  </div>
                  <div>
                    <b>Color/Size:</b> {lastScannedItem.colorSize}
                  </div>
                  <div className="col-span-2">
                    <b>Description:</b> {lastScannedItem.description}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Paused Summary Box */}
        {phase === 'paused' && (
          <div className="mt-6 rounded-[10px] border border-[#fecaca] bg-[#fef2f2] p-5">
            <h3 className="mt-0 text-lg font-bold text-[#dc2626]">
              ⏸️ Session Paused - Pending / Missing HU List
            </h3>
            <p className="mt-1 mb-3 text-sm text-[#334155]">
              මෙතෙක් Scan කර නොමැති Handling Units (HU) විස්තර පහත දැක්වේ:
            </p>
            <div className="max-h-[250px] overflow-y-auto rounded-[6px] border border-[#fca5a5] bg-white p-2.5">
              {missingItems.length === 0 ? (
                <b className="text-green-700">🎉 සියලුම Handling Units Scan කර අවසන්!</b>
              ) : (
                <table className="w-full border-collapse text-[0.88em]">
                  <thead>
                    <tr className="bg-[#ef4444] text-white">
                      <th className="border border-[#cbd5e1] px-3 py-2.5 text-center text-[0.78em] font-bold uppercase">
                        No.
                      </th>
                      <th className="border border-[#cbd5e1] px-3 py-2.5 text-center text-[0.78em] font-bold uppercase">
                        Handling Unit
                      </th>
                      <th className="border border-[#cbd5e1] px-3 py-2.5 text-center text-[0.78em] font-bold uppercase">
                        Billing Doc
                      </th>
                      <th className="border border-[#cbd5e1] px-3 py-2.5 text-center text-[0.78em] font-bold uppercase">
                        Material
                      </th>
                      <th className="border border-[#cbd5e1] px-3 py-2.5 text-center text-[0.78em] font-bold uppercase">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingItems.map((item, idx) => (
                      <tr key={item.hu} className="even:bg-[#f8fafc] hover:bg-[#f1f5f9]">
                        <td className="border border-[#cbd5e1] px-3 py-2 text-center tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="border border-[#cbd5e1] px-3 py-2 text-center font-bold">
                          {item.hu}
                        </td>
                        <td className="border border-[#cbd5e1] px-3 py-2 text-center">
                          {item.billingDoc}
                        </td>
                        <td className="border border-[#cbd5e1] px-3 py-2 text-center">
                          {item.material}
                        </td>
                        <td className="border border-[#cbd5e1] px-3 py-2 text-center">
                          {item.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Billing Document Search Card */}
        <div className="mt-6 rounded-[10px] border border-[#cbd5e1] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <h3 className="mt-0 text-lg font-bold text-[#2563eb]">🔍 Billing Document Search</h3>
          <p className="mt-1 mb-3 text-[0.9em] text-[#64748b]">
            Billing Document එකක් ඇතුළත් කර ඊට අදාළ Handling Units සහ ඒවායේ Scan තත්ත්වය පරීක්ෂා කරන්න:
          </p>
          <input
            id="billingSearchInput"
            type="text"
            value={billingSearch}
            onChange={(e) => setBillingSearch(e.target.value)}
            placeholder="Enter Billing Document Number..."
            className="w-full rounded-[6px] border border-[#cbd5e1] bg-[#f8fafc] px-3.5 py-[11px] text-[14px] text-[#0f172a] transition-all focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)] focus:outline-none"
          />

          {billingSearch.trim() && (
            <div className="mt-3">
              {billingMatches.length === 0 ? (
                <div className="p-1.5 font-bold text-[#ef4444]">
                  ⚠️ එවැනි Billing Document එකක් හමු නොවීය!
                </div>
              ) : (
                <div className="max-h-[220px] overflow-y-auto">
                  <table className="mt-2.5 w-full border-collapse text-[0.88em]">
                    <thead className="sticky top-0">
                      <tr>
                        <th className="border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2.5 text-center text-[0.78em] font-bold tracking-[0.04em] text-[#334155] uppercase">
                          Billing Doc
                        </th>
                        <th className="border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2.5 text-center text-[0.78em] font-bold tracking-[0.04em] text-[#334155] uppercase">
                          HU Number
                        </th>
                        <th className="border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2.5 text-center text-[0.78em] font-bold tracking-[0.04em] text-[#334155] uppercase">
                          Material
                        </th>
                        <th className="border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2.5 text-center text-[0.78em] font-bold tracking-[0.04em] text-[#334155] uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingMatches.map(({ billingDoc, item, isScanned }) => (
                        <tr
                          key={`${billingDoc}-${item.hu}`}
                          className="even:bg-[#f8fafc] hover:bg-[#f1f5f9]"
                        >
                          <td className="border border-[#cbd5e1] px-3 py-2.5 text-center font-bold">
                            {billingDoc}
                          </td>
                          <td className="border border-[#cbd5e1] px-3 py-2.5 text-center">
                            {item.hu}
                          </td>
                          <td className="border border-[#cbd5e1] px-3 py-2.5 text-center">
                            {item.material}
                          </td>
                          <td className="border border-[#cbd5e1] px-3 py-2.5 text-center">
                            {isScanned ? (
                              <span className="font-bold text-[#10b981]">✅ Scanned</span>
                            ) : (
                              <span className="font-bold text-[#ef4444]">❌ Missing</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Final Missing Items Box */}
        {phase === 'completed' && missingItems.length > 0 && (
          <div className="mt-6 rounded-[10px] border border-[#fde68a] bg-[#fffbeb] p-5">
            <h3 className="mt-0 text-lg font-bold text-[#b45309]">
              ⚠️ Final Missing Boxes / Handling Units (Not Scanned)
            </h3>
            <p className="mt-1 mb-3 text-sm text-[#334155]">
              The following Handling Units were in the master list but not scanned:
            </p>
            <div className="max-h-[250px] overflow-y-auto rounded-[6px] border border-[#cbd5e1] bg-white p-2.5">
              <table className="w-full border-collapse text-[0.88em]">
                <thead>
                  <tr className="bg-[#b45309] text-white">
                    <th className="border border-[#cbd5e1] px-3 py-2.5 text-center text-[0.78em] font-bold uppercase">
                      No.
                    </th>
                    <th className="border border-[#cbd5e1] px-3 py-2.5 text-center text-[0.78em] font-bold uppercase">
                      Handling Unit
                    </th>
                    <th className="border border-[#cbd5e1] px-3 py-2.5 text-center text-[0.78em] font-bold uppercase">
                      Billing Doc
                    </th>
                    <th className="border border-[#cbd5e1] px-3 py-2.5 text-center text-[0.78em] font-bold uppercase">
                      Material
                    </th>
                    <th className="border border-[#cbd5e1] px-3 py-2.5 text-center text-[0.78em] font-bold uppercase">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {missingItems.map((item, idx) => (
                    <tr key={item.hu} className="even:bg-[#f8fafc] hover:bg-[#f1f5f9]">
                      <td className="border border-[#cbd5e1] px-3 py-2 text-center tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="border border-[#cbd5e1] px-3 py-2 text-center font-bold">
                        {item.hu}
                      </td>
                      <td className="border border-[#cbd5e1] px-3 py-2 text-center">
                        {item.billingDoc}
                      </td>
                      <td className="border border-[#cbd5e1] px-3 py-2 text-center">
                        {item.material}
                      </td>
                      <td className="border border-[#cbd5e1] px-3 py-2 text-center">
                        {item.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Export Action Row */}
        <div className="mt-[25px] flex flex-wrap items-center justify-between gap-2.5">
          <div>
            {phase === 'completed' && (
              <button
                type="button"
                onClick={handleExportSessionReport}
                className="cursor-pointer rounded-[6px] border-0 bg-[#10b981] px-[18px] py-2.5 text-[14px] font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:-translate-y-px hover:bg-[#059669]"
              >
                📥 Download Session Summary Report
              </button>
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2">
              <label className="text-[0.88em] font-bold text-[#334155]">Select Period:</label>
              <select
                aria-label="Select Year"
                value={exportYear}
                onChange={(e) => {
                  setExportYear(e.target.value);
                  setMonthlyExportFeedback('');
                }}
                className="rounded-[6px] border border-[#cbd5e1] bg-white px-3 py-2 text-[14px] font-semibold text-[#0f172a] focus:border-[#2563eb] focus:outline-none"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <select
                aria-label="Select Month"
                value={exportMonth}
                onChange={(e) => {
                  setExportMonth(e.target.value);
                  setMonthlyExportFeedback('');
                }}
                className="rounded-[6px] border border-[#cbd5e1] bg-white px-3 py-2 text-[14px] font-semibold text-[#0f172a] focus:border-[#2563eb] focus:outline-none"
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.val} value={m.val}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleExportMonthlyReport}
                className="cursor-pointer rounded-[6px] border-0 bg-[#2563eb] px-[18px] py-2.5 text-[14px] font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:-translate-y-px hover:bg-[#1d4ed8]"
              >
                📊 Download Monthly Report
              </button>
            </div>
            {monthlyExportFeedback && (
              <div className="text-xs font-semibold text-[#b45309]">{monthlyExportFeedback}</div>
            )}
          </div>
        </div>

        {/* Live Scan History Log Card */}
        <div className="mt-6 rounded-[10px] border border-[#cbd5e1] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="mb-[18px] flex items-center justify-between border-b border-[#e2e8f0] pb-3 text-[1.1em] font-bold tracking-[-0.01em] text-[#2563eb]">
            Live Scan History Log
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            <table className="mt-2.5 w-full border-collapse text-[0.88em]">
              <thead>
                <tr>
                  <th className="border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2.5 text-center text-[0.78em] font-bold tracking-[0.04em] text-[#334155] uppercase">
                    No.
                  </th>
                  <th className="border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2.5 text-center text-[0.78em] font-bold tracking-[0.04em] text-[#334155] uppercase">
                    Handling Unit Number
                  </th>
                  <th className="border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2.5 text-center text-[0.78em] font-bold tracking-[0.04em] text-[#334155] uppercase">
                    Billing Doc
                  </th>
                  <th className="border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2.5 text-center text-[0.78em] font-bold tracking-[0.04em] text-[#334155] uppercase">
                    Material / Description
                  </th>
                  <th className="border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2.5 text-center text-[0.78em] font-bold tracking-[0.04em] text-[#334155] uppercase">
                    Time
                  </th>
                  <th className="border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2.5 text-center text-[0.78em] font-bold tracking-[0.04em] text-[#334155] uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayHistory.map((item) => (
                  <tr
                    key={`${item.no}-${item.handlingUnit}`}
                    className="even:bg-[#f8fafc] hover:bg-[#f1f5f9]"
                  >
                    <td className="border border-[#cbd5e1] px-3 py-2.5 text-center tabular-nums">
                      {item.no}
                    </td>
                    <td className="border border-[#cbd5e1] px-3 py-2.5 text-center font-bold">
                      {item.handlingUnit}
                    </td>
                    <td className="border border-[#cbd5e1] px-3 py-2.5 text-center">
                      {item.billingDoc}
                    </td>
                    <td className="border border-[#cbd5e1] px-3 py-2.5 text-center">
                      {item.material} - {item.description}
                    </td>
                    <td className="border border-[#cbd5e1] px-3 py-2.5 text-center tabular-nums">
                      {item.time}
                    </td>
                    <td
                      className={`border border-[#cbd5e1] px-3 py-2.5 text-center font-bold ${
                        item.status === 'OK'
                          ? 'text-[#10b981]'
                          : item.status === 'DUPLICATE'
                            ? 'text-[#f59e0b]'
                            : 'text-[#ef4444]'
                      }`}
                    >
                      {item.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmEndModal
        open={showEndModal}
        containerNo={containerNo.trim()}
        shipmentNo={shipmentNo.trim()}
        scannedCount={scannedCartons}
        totalCount={totalCartons}
        onCancel={() => setShowEndModal(false)}
        onConfirm={confirmEndLoading}
      />
    </div>
  );
}
