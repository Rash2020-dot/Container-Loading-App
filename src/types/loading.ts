export interface HandlingUnitItem {
  hu: string;
  billingDoc: string;
  material: string;
  description: string;
  colorSize: string;
}

export type ScanStatus = 'OK' | 'DUPLICATE' | 'NOT IN MASTER LIST';

export interface ScanLogEntry {
  no: number;
  handlingUnit: string;
  billingDoc: string;
  material: string;
  description: string;
  time: string;
  status: ScanStatus;
}

export interface SessionSummaryRecord {
  Date: string;
  'Container No': string;
  'Shipment No': string;
  'Start Time': string;
  'End Time': string;
  'Process Time': string;
  'Break Time': string;
  'Expected Boxes': number;
  'Scanned Boxes': number;
  'Missing Boxes': number;
  'Poly Bags': number;
  'Double Height Boxes': number;
  'Long Boxes': number;
}

export type AlertTone = 'green' | 'yellow' | 'red';

export interface AlertMessage {
  id: number;
  tone: AlertTone;
  title: string;
  detail?: string;
}

export type SessionPhase = 'idle' | 'active' | 'paused' | 'locked' | 'completed';
