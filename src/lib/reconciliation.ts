/**
 * Lógica pura de conciliación bancaria — sin I/O.
 * Compara un pago reportado (OCR de comprobante) contra los movimientos
 * reales del extracto bancario importado, para confirmar que la plata
 * efectivamente entró a la cuenta del edificio.
 */

export type ReconcileInput = {
  amount: number;
  reference: string | null | undefined;
  date: string | null | undefined; // YYYY-MM-DD u otro formato reconocible
};

export type BankMovementLike = {
  id: string;
  date: number;      // unix seconds
  amount: number;
  reference: string;
};

export type ReconcileResult = {
  status: "verified" | "pending";
  matchedMovementId: string | null;
  notes: string;
};

function parseDateFlexible(value: string | null | undefined): Date | null {
  if (!value) return null;
  const s = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const dmyMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.exec(s);
  if (dmyMatch) {
    const [, d, m, yRaw] = dmyMatch;
    const y = yRaw.length === 2 ? Number(`20${yRaw}`) : Number(yRaw);
    return new Date(y, Number(m) - 1, Number(d));
  }
  return null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

export function reconcilePayment(
  payment: ReconcileInput,
  movements: BankMovementLike[]
): ReconcileResult {
  const amount = payment.amount;
  const reference = (payment.reference ?? "").trim();
  const paymentDate = parseDateFlexible(payment.date);

  if (!amount || amount <= 0) {
    return { status: "pending", matchedMovementId: null, notes: "Monto no legible en el comprobante" };
  }

  // ── Pasada 1: referencia exacta + monto exacto ──────────────────────────
  if (reference) {
    const match = movements.find(
      (m) => m.reference.trim() === reference && m.amount === amount
    );
    if (match) {
      return { status: "verified", matchedMovementId: match.id, notes: "" };
    }
  }

  // ── Pasada 2: monto exacto + fecha ±2 días ──────────────────────────────
  if (paymentDate) {
    const match = movements.find((m) => {
      if (m.amount !== amount) return false;
      const bankDate = new Date(m.date * 1000);
      return daysBetween(paymentDate, bankDate) <= 2;
    });
    if (match) {
      return {
        status: "verified",
        matchedMovementId: match.id,
        notes: "Verificado por monto y fecha (sin referencia exacta)",
      };
    }
  }

  // ── Pasada 3: el monto existe en algún movimiento pero nada más coincide ─
  const amountExists = movements.some((m) => m.amount === amount);
  if (amountExists) {
    return {
      status: "pending",
      matchedMovementId: null,
      notes: "Monto encontrado en el banco pero la referencia/fecha no coincide exactamente",
    };
  }

  return {
    status: "pending",
    matchedMovementId: null,
    notes: "No se encontró coincidencia en los movimientos bancarios importados",
  };
}
