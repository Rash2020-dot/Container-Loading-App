import { readSheet } from 'read-excel-file/browser';
import writeXlsxFile, { type Row, type SheetData } from 'write-excel-file/browser';
import type {
  HandlingUnitItem,
  ScanLogEntry,
  SessionSummaryRecord,
} from '../types/loading';

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '00h 00m 00s';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

export function formatClockTime(date: Date): string {
  return [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join(':');
}

export function formatDateISO(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function formatDateTime(date: Date): string {
  return `${formatDateISO(date)} ${formatClockTime(date)}`;
}

export function formatDateCompact(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

export interface ParsedMasterList {
  huMap: Map<string, HandlingUnitItem>;
  billingDocMap: Map<string, HandlingUnitItem[]>;
}

export async function parseMasterPackingList(file: File): Promise<ParsedMasterList> {
  const rows = await readSheet(file);

  if (rows.length < 2) {
    throw new Error('The Excel file is empty or missing data rows.');
  }

  const headers = (rows[0] || []).map((cell) => String(cell ?? '').trim().toLowerCase());

  let huIndex = headers.findIndex(
    (h) =>
      h === 'handling unit' ||
      h === 'hu' ||
      h === 'hu number' ||
      h === 'handling unit number'
  );
  if (huIndex === -1) {
    huIndex = headers.findIndex((h) => h.includes('handling unit') && !h.includes('uom'));
  }
  if (huIndex === -1) huIndex = 0;

  const billDocIndex = headers.findIndex(
    (h) =>
      h.includes('billing doc') ||
      h.includes('billing document') ||
      h === 'billing no' ||
      h.includes('billing')
  );
  const matIndex = headers.findIndex(
    (h) => h === 'material' || (h.includes('material') && !h.includes('pricing'))
  );
  const descIndex = headers.findIndex(
    (h) => h.includes('item description') || h.includes('description')
  );
  const colorIndex = headers.findIndex((h) => h === 'color' || h.includes('color'));
  const sizeIndex = headers.findIndex((h) => h.includes('main size') || h === 'size');

  const huMap = new Map<string, HandlingUnitItem>();
  const billingDocMap = new Map<string, HandlingUnitItem[]>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row[huIndex] === undefined || row[huIndex] === null) continue;

    const hu = String(row[huIndex]).trim();
    if (!hu || hu.toLowerCase() === 'undefined' || hu.toLowerCase() === 'null') continue;

    const billDoc =
      billDocIndex !== -1 && row[billDocIndex] !== undefined && row[billDocIndex] !== null
        ? String(row[billDocIndex]).trim() || '-'
        : '-';
    const mat =
      matIndex !== -1 && row[matIndex] !== undefined && row[matIndex] !== null
        ? String(row[matIndex]).trim() || '-'
        : '-';
    const desc =
      descIndex !== -1 && row[descIndex] !== undefined && row[descIndex] !== null
        ? String(row[descIndex]).trim() || '-'
        : '-';
    const color =
      colorIndex !== -1 && row[colorIndex] !== undefined && row[colorIndex] !== null
        ? String(row[colorIndex]).trim()
        : '';
    const size =
      sizeIndex !== -1 && row[sizeIndex] !== undefined && row[sizeIndex] !== null
        ? String(row[sizeIndex]).trim()
        : '';

    const colorSize = `${color} / ${size}`.replace(/^\s*\/\s*|\s*\/\s*$/g, '').trim() || '-';

    const item: HandlingUnitItem = {
      hu,
      billingDoc: billDoc,
      material: mat,
      description: desc,
      colorSize,
    };

    if (!huMap.has(hu)) {
      huMap.set(hu, item);
      if (billDoc !== '-') {
        const list = billingDocMap.get(billDoc) ?? [];
        list.push(item);
        billingDocMap.set(billDoc, list);
      }
    }
  }

  if (huMap.size === 0) {
    throw new Error('No valid Handling Unit rows were found in the worksheet.');
  }

  return { huMap, billingDocMap };
}

function headerRow(titles: string[]): Row {
  return titles.map((title) => ({
    value: title,
    fontWeight: 'bold' as const,
  }));
}

function buildSummarySheetData(records: SessionSummaryRecord[]): SheetData {
  const headers = [
    'Date',
    'Container No',
    'Shipment No',
    'Start Time',
    'End Time',
    'Process Time',
    'Break Time',
    'Expected Boxes',
    'Scanned Boxes',
    'Missing Boxes',
    'Poly Bags',
    'Double Height Boxes',
    'Long Boxes',
  ];

  const rows: SheetData = [headerRow(headers)];
  for (const rec of records) {
    rows.push([
      { type: String, value: rec.Date },
      { type: String, value: rec['Container No'] },
      { type: String, value: rec['Shipment No'] },
      { type: String, value: rec['Start Time'] },
      { type: String, value: rec['End Time'] },
      { type: String, value: rec['Process Time'] },
      { type: String, value: rec['Break Time'] },
      { type: Number, value: rec['Expected Boxes'] },
      { type: Number, value: rec['Scanned Boxes'] },
      { type: Number, value: rec['Missing Boxes'] },
      { type: Number, value: rec['Poly Bags'] },
      { type: Number, value: rec['Double Height Boxes'] },
      { type: Number, value: rec['Long Boxes'] },
    ]);
  }
  return rows;
}

export async function downloadSamplePackingList(): Promise<void> {
  const data: SheetData = [
    headerRow([
      'Handling Unit',
      'Billing Doc',
      'Material',
      'Item Description',
      'Color',
      'Main Size',
    ]),
    [
      { type: String, value: 'HU10004501' },
      { type: String, value: 'BD-2026-001' },
      { type: String, value: 'MAT-8841' },
      { type: String, value: 'Cotton Crew Neck Tee' },
      { type: String, value: 'Navy' },
      { type: String, value: 'M' },
    ],
    [
      { type: String, value: 'HU10004502' },
      { type: String, value: 'BD-2026-001' },
      { type: String, value: 'MAT-8841' },
      { type: String, value: 'Cotton Crew Neck Tee' },
      { type: String, value: 'Navy' },
      { type: String, value: 'L' },
    ],
    [
      { type: String, value: 'HU10004503' },
      { type: String, value: 'BD-2026-002' },
      { type: String, value: 'MAT-9104' },
      { type: String, value: 'Lightweight Fleece Hoodie' },
      { type: String, value: 'Charcoal' },
      { type: String, value: 'XL' },
    ],
    [
      { type: String, value: 'HU10004504' },
      { type: String, value: 'BD-2026-002' },
      { type: String, value: 'MAT-9104' },
      { type: String, value: 'Lightweight Fleece Hoodie' },
      { type: String, value: 'Charcoal' },
      { type: String, value: 'M' },
    ],
    [
      { type: String, value: 'HU10004505' },
      { type: String, value: 'BD-2026-003' },
      { type: String, value: 'MAT-7720' },
      { type: String, value: 'Athletic Knit Joggers' },
      { type: String, value: 'Black' },
      { type: String, value: 'S' },
    ],
  ];

  await writeXlsxFile(data, { sheet: 'Master Packing List' }).toFile(
    'Sample_Master_Packing_List.xlsx'
  );
}

export async function exportSessionExcel(
  summary: SessionSummaryRecord,
  scanHistory: ScanLogEntry[],
  missingItems: HandlingUnitItem[],
  shipmentNo: string
): Promise<void> {
  const orderedLogs = [...scanHistory].reverse();
  const scanLogData: SheetData = [
    headerRow(['No', 'Handling Unit', 'Billing Doc', 'Material', 'Description', 'Time', 'Status']),
    ...orderedLogs.map((item): Row => [
      { type: Number, value: item.no },
      { type: String, value: item.handlingUnit },
      { type: String, value: item.billingDoc },
      { type: String, value: item.material },
      { type: String, value: item.description },
      { type: String, value: item.time },
      { type: String, value: item.status },
    ]),
  ];

  const sheets: Array<{ sheet: string; data: SheetData }> = [
    { sheet: 'Session Summary', data: buildSummarySheetData([summary]) },
    { sheet: 'Scan Logs', data: scanLogData },
  ];

  if (missingItems.length > 0) {
    const missingData: SheetData = [
      headerRow(['Missing Handling Unit', 'Billing Document', 'Material', 'Description']),
      ...missingItems.map((item): Row => [
        { type: String, value: item.hu },
        { type: String, value: item.billingDoc },
        { type: String, value: item.material },
        { type: String, value: item.description },
      ]),
    ];
    sheets.push({ sheet: 'Missing Boxes', data: missingData });
  }

  const safeShipment = (shipmentNo || 'Session').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Shipment_${safeShipment}_${formatDateCompact(new Date())}.xlsx`;
  await writeXlsxFile(sheets).toFile(filename);
}

export function getMonthStorageKey(year: string, month: string): string {
  return `shipment_data_${year}_${month}`;
}

export function getMonthlyRecords(year: string, month: string): SessionSummaryRecord[] {
  try {
    const raw = localStorage.getItem(getMonthStorageKey(year, month));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SessionSummaryRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveMonthlySummary(summary: SessionSummaryRecord): void {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const key = getMonthStorageKey(year, month);
  const existing = getMonthlyRecords(year, month);
  existing.push(summary);
  localStorage.setItem(key, JSON.stringify(existing));
}

export async function exportMonthlyExcel(year: string, month: string): Promise<number> {
  const records = getMonthlyRecords(year, month);
  if (records.length === 0) return 0;

  await writeXlsxFile(buildSummarySheetData(records), {
    sheet: 'Monthly Summary',
  }).toFile(`Monthly_Shipment_Report_${year}_${month}.xlsx`);
  return records.length;
}
