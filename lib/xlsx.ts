import { computeLedger } from "./balance";
import { isoToDate } from "./date";
import { DOC_TAGS, type BeginningBalances, type LedgerEntry } from "./types";

const HEADERS = [
  "DATE",
  "AGENT NUMBER",
  "TYPE",
  "NET DUE",
  "DEPOSIT",
  "BALANCE",
  "REFERENCE",
  "REMARKS",
] as const;
const WIDTHS = [12, 16, 11, 14, 14, 16, 24, 22];
// 1-based column indexes (header is row 1).
const DATE_COL = 1;
const MONEY_COLS = [4, 5, 6]; // NET DUE, DEPOSIT, BALANCE

type Cell = string | number | Date;

/**
 * Build and download the reconciliation ledger as an .xlsx with a native, styled
 * Excel table. Rows are grouped by agent and ordered by date; each agent block
 * opens with a BEGINNING row showing the opening balance, and every entry shows
 * its NET DUE (+) or DEPOSIT (−) and the resulting running BALANCE. Exports the
 * full ledger (balances only make sense as a complete tally). Returns the entry
 * count.
 */
export async function exportLedger(
  entries: LedgerEntry[],
  beginning: BeginningBalances,
): Promise<number> {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  wb.creator = "RemitDesk";
  const ws = wb.addWorksheet("Ledger");

  const rows = computeLedger(entries, beginning);
  const tableRows: Cell[][] = [];
  let lastAgent: string | null = null;
  for (const r of rows) {
    if (r.agentKey !== lastAgent) {
      lastAgent = r.agentKey;
      tableRows.push([
        "",
        r.agentNumber || r.agentKey,
        "BEGINNING",
        "",
        "",
        beginning[r.agentKey] ?? 0,
        "",
        "Beginning balance",
      ]);
    }
    tableRows.push([
      isoToDate(r.date) ?? "",
      r.agentNumber || r.agentKey,
      DOC_TAGS[r.docType],
      r.netDue || "",
      r.deposit || "",
      r.balance,
      r.reference,
      r.remarks,
    ]);
  }
  // exceljs requires a table to have at least one body row.
  if (tableRows.length === 0) tableRows.push(["", "", "", "", "", "", "", ""]);

  ws.addTable({
    name: "Ledger",
    ref: "A1",
    headerRow: true,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: HEADERS.map((name) => ({ name, filterButton: true })),
    rows: tableRows,
  });

  WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  for (let i = 0; i < tableRows.length; i++) {
    const rowNo = i + 2;
    const d = ws.getCell(rowNo, DATE_COL);
    if (d.value instanceof Date) d.numFmt = "m/d/yyyy";
    for (const col of MONEY_COLS) {
      const c = ws.getCell(rowNo, col);
      if (typeof c.value === "number") c.numFmt = "#,##0.00";
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `remitdesk-ledger-${stamp}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
  return rows.length;
}
