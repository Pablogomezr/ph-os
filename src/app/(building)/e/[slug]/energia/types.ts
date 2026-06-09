import type { tenantSchema } from "@/lib/db/tenant";

export type Unit = typeof tenantSchema.units.$inferSelect;

export type ReadingWithUnit = {
  id: string;
  unitId: string;
  unitNumber: string;
  meterNumber: string | null;
  previousReading: number;
  currentReading: number;
  consumption: number;      // currentReading - previousReading
  ratePerKwh: number;
  estimatedAmount: number;  // consumption * ratePerKwh
  readingDate: number;
  photoUrl: string | null;
  chargeId: string | null;
  isBilled: boolean;        // chargeId !== null
  createdAt: number;
};

export type EnergyKPIs = {
  totalConsumptionKwh: number;
  totalBilledAmount: number;
  unbilledCount: number;
  billedCount: number;
};

// unitId → última lectura actual (para pre-llenar "Lectura anterior")
export type LastReadingMap = Record<string, number>;
