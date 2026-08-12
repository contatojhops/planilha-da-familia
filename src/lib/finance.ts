import { monthKey } from "./format";

export type Tx = {
  id: string;
  description: string;
  amount: number | string;
  type: "income" | "expense";
  status: "planned" | "realized";
  tx_date: string;
  category_id: string | null;
  owner_id: string | null;
  payment_method: string;
  recurrence: "none" | "monthly" | "yearly" | "installment";
  recurrence_end: string | null;
  installment_no: number | null;
  installment_total: number | null;
  created_by: string;
  is_shared?: boolean;
  shared_with?: string[] | null;
  card_id?: string | null;
};

export type MonthTransaction = {
  transaction_id: string;
  origin_transaction_id: string;
  description: string;
  display_date: string;
  amount: number;
  type: "income" | "expense";
  status: "planned" | "realized";
  category_id: string | null;
  owner_id: string | null;
  card_id: string | null;
  payment_method: string;
  recurrence: "none" | "monthly" | "yearly" | "installment";
  installment_label: string | null;
  is_projected: boolean;
};

export type Occurrence = Tx & { occurrenceMonth: string; virtual: boolean; amountNum: number };

/** Returns the list of "YYYY-MM" keys for `count` months starting at the current month. */
export function monthWindow(count = 12, startOffset = 0): string[] {
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + startOffset);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    return monthKey(d);
  });
}

function addMonthsKey(key: string, add: number) {
  const [y = "2000", m = "01"] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1 + add, 1);
  return monthKey(d);
}

/**
 * Expands recurring / installment transactions into concrete monthly occurrences
 * inside the given month window. The original row counts as the first occurrence.
 */
export function expandOccurrences(txs: Tx[], months: string[]): Occurrence[] {
  if (months.length === 0) return [];
  const first = months[0]!;
  const last = months[months.length - 1]!;
  const out: Occurrence[] = [];

  const inWindow = (k: string) => k >= first && k <= last;

  for (const tx of txs) {
    const amountNum = Number(tx.amount);
    const startKey = monthKey(tx.tx_date);
    const endKey = tx.recurrence_end ? monthKey(tx.recurrence_end) : last;

    const push = (key: string, virtual: boolean) =>
      out.push({ ...tx, amountNum, occurrenceMonth: key, virtual });

    if (tx.recurrence === "none") {
      if (inWindow(startKey)) push(startKey, false);
      continue;
    }

    if (tx.recurrence === "monthly") {
      let cursor = startKey;
      let guard = 0;
      while (cursor <= endKey && cursor <= last && guard < 240) {
        if (inWindow(cursor)) push(cursor, cursor !== startKey);
        cursor = addMonthsKey(cursor, 1);
        guard++;
      }
      continue;
    }

    if (tx.recurrence === "yearly") {
      let cursor = startKey;
      let guard = 0;
      while (cursor <= endKey && cursor <= last && guard < 40) {
        if (inWindow(cursor)) push(cursor, cursor !== startKey);
        cursor = addMonthsKey(cursor, 12);
        guard++;
      }
      continue;
    }

    // installment: remaining parcels from the current one
    const total = tx.installment_total ?? 1;
    const current = tx.installment_no ?? 1;
    for (let i = 0; i < total - current + 1; i++) {
      const key = addMonthsKey(startKey, i);
      if (key > last) break;
      if (inWindow(key)) push(key, i > 0);
    }
  }

  return out;
}

export type MonthProjection = {
  key: string;
  income: number;
  incomeRealized: number;
  expense: number;
  expenseRealized: number;
  balance: number;
  cumulative: number;
  deficit: number;
};

export function buildProjection(
  occurrences: Occurrence[],
  months: string[],
  openingBalance = 0,
): MonthProjection[] {
  const map = new Map<string, MonthProjection>(
    months.map((key) => [
      key,
      {
        key,
        income: 0,
        incomeRealized: 0,
        expense: 0,
        expenseRealized: 0,
        balance: 0,
        cumulative: 0,
        deficit: 0,
      },
    ]),
  );

  for (const occ of occurrences) {
    const row = map.get(occ.occurrenceMonth);
    if (!row) continue;
    if (occ.type === "income") {
      row.income += occ.amountNum;
      if (occ.status === "realized") row.incomeRealized += occ.amountNum;
    } else {
      row.expense += occ.amountNum;
      if (occ.status === "realized") row.expenseRealized += occ.amountNum;
    }
  }

  let running = openingBalance;
  const rows: MonthProjection[] = [];
  for (const key of months) {
    const row = map.get(key)!;
    row.balance = row.income - row.expense;
    running += row.balance;
    row.cumulative = running;
    row.deficit = row.balance < 0 ? Math.abs(row.balance) : 0;
    rows.push(row);
  }
  return rows;
}

export const PAYMENT_LABELS: Record<string, string> = {
  cash: "Dinheiro",
  debit: "Débito",
  credit: "Crédito",
  pix: "Pix",
  boleto: "Boleto",
  transfer: "Transferência",
  other: "Outro",
};

export const RECURRENCE_LABELS: Record<string, string> = {
  none: "Único",
  monthly: "Mensal",
  yearly: "Anual",
  installment: "Parcelado",
};

export const KIND_LABELS: Record<string, string> = {
  income: "Receitas",
  fixed_expense: "Despesas fixas",
  variable_expense: "Despesas variáveis",
  debt: "Dívidas",
};

export const BILL_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado",
  scheduled: "Agendado",
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  member: "Membro",
  viewer: "Visualizador",
};

export const ASSET_LABELS: Record<string, string> = {
  fixed_income: "Renda fixa",
  stocks: "Ações",
  funds: "Fundos",
  crypto: "Cripto",
  pension: "Previdência",
  real_estate: "Imóveis",
  other: "Outros",
};

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(";"), ...rows.map((r) => headers.map((h) => escape(r[h])).join(";"))].join(
    "\n",
  );
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const blob = new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
