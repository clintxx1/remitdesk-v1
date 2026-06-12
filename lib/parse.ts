import { formatAgent, normalizeAgentKey } from "./agent";
import { classifyDoc } from "./classify";
import { MONTHS, toISODate } from "./date";
import { parseMoney } from "./money";
import { isDeposit, type DocType, type ParsedDoc } from "./types";

/** Normalize OCR quirks (odd dashes, runs of spaces) without losing line breaks. */
function normalize(text: string): string {
  return text
    .replace(/[‐-―−]/g, "-") // hyphen/dash/minus variants -> "-"
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Shared field extractors
// ---------------------------------------------------------------------------

/**
 * Agent number in 3-4-1 form, e.g. `413-0133-3`. This is the *unlabeled* fallback,
 * so it requires literal dashes: on a noisy ONCOL slip, space-separated digit runs
 * (an account number, a validation trace) would otherwise be misread as an agent
 * number. A real agent number always prints with dashes; the labelled extractor
 * (AGENCY ID / AGENT CODE) stays permissive for spaced values.
 */
function findDashedAgent(text: string): string | null {
  const m = text.match(/(?<!\d)(\d{3})-(\d{4})-(\d)(?!\d)/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Numeric agent after a label, e.g. `AGENT CODE 41301333`, `AGENCY NO. 41301180`. */
function findLabelledAgent(text: string, label: RegExp): string | null {
  const re = new RegExp(`${label.source}[^0-9]{0,14}([0-9][0-9\\-\\s]{6,})`, "i");
  const m = text.match(re);
  if (!m) return null;
  const digits = normalizeAgentKey(m[1]);
  return digits.length >= 7 ? digits : null;
}

/**
 * Month-name dates in day-month-year order, e.g. compact `29MAY2026` or spaced
 * `28 MAY 26`. Returns the first (or last) ISO date found. The validation stamp
 * and the report header both print this order, so it naturally prefers the
 * machine-printed date over a handwritten `May 29, 2026` (month-day order).
 */
function findDayMonthDate(text: string, which: "first" | "last" = "first"): string {
  const re = new RegExp(`(\\d{1,2})\\s*(${MONTHS.join("|")})\\s*(\\d{2,4})`, "gi");
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const iso = toISODate(`${m[1]}${m[2]}${m[3]}`); // compact form -> ISO
    if (iso) found.push(iso);
  }
  if (!found.length) return "";
  return which === "last" ? found[found.length - 1] : found[0];
}

function buildParsed(
  docType: DocType,
  agentRaw: string,
  date: string,
  amount: number | null,
  reference: string,
  raw: string,
): ParsedDoc {
  const agentKey = normalizeAgentKey(agentRaw);
  // A report's NET can be negative (PCSO owes the agent); a deposit is always a
  // positive magnitude, so guard it against a stray sign / handwritten flourish.
  const normAmount = amount == null ? null : isDeposit(docType) ? Math.abs(amount) : amount;
  const missing: string[] = [];
  if (!agentKey) missing.push("agent number");
  if (!date) missing.push("date");
  if (normAmount == null) missing.push("amount");
  return {
    docType,
    valid: missing.length === 0,
    agentNumber: agentKey ? formatAgent(agentRaw) : "",
    agentKey,
    date,
    amount: normAmount,
    reference,
    reason: missing.length ? `couldn't read ${missing.join(", ")}` : "",
    raw,
  };
}

// ---------------------------------------------------------------------------
// Total Current Day report (thermal receipt) — NET DUE / liability
// ---------------------------------------------------------------------------

function findReportNet(text: string): number | null {
  // "NET 11159.42", or a negative NET shown as "11159.42-" / "-11159.42" (PCSO owes
  // the agent). Capture an optional leading/trailing minus; avoid SALES/COMMIS/etc.
  const same = text.match(/\bNET\b[^0-9\n-]*(-?[0-9][0-9.,]*-?)/i);
  if (same) {
    const n = parseMoney(same[1]);
    if (n != null) return n;
  }
  // ...or with the value wrapped onto the next line.
  const wrapped = text.match(/\bNET\b[\s:]*\n?\s*(-?[0-9][0-9.,]*-?)/i);
  return wrapped ? parseMoney(wrapped[1]) : null;
}

function parseReport(text: string): ParsedDoc {
  const agentRaw =
    findLabelledAgent(text, /AGENCY\s*ID/i) ?? findDashedAgent(text) ?? "";
  const date = findDayMonthDate(text, "first"); // header date, e.g. 28MAY26
  const amount = findReportNet(text);
  return buildParsed("report", agentRaw, date, amount, "", text);
}

// ---------------------------------------------------------------------------
// ONCOL payment slip (LandBank) — DEPOSIT. Read from the machine validation
// stamp where possible; the handwritten fields are unreliable for OCR.
// ---------------------------------------------------------------------------

function findOncolDate(text: string): string {
  const stamp = findDayMonthDate(text, "first"); // 29MAY2026 from the stamp
  if (stamp) return stamp;
  const hand = text.match(/([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/); // "May 29, 2026"
  if (hand) {
    const iso = toISODate(`${hand[1]} ${hand[2]} ${hand[3]}`);
    if (iso) return iso;
  }
  return "";
}

function findOncolAmount(text: string): number | null {
  // Prefer the stamped "AMOUNT PHP 11,160.00" over the handwritten figure.
  const php = text.match(/AMOUNT\s*(?:PHP|₱|P)\s*([0-9][0-9.,]*)/i);
  if (php) {
    const n = parseMoney(php[1]);
    if (n != null) return n;
  }
  const any = text.match(/\bAMOUNT\b[^0-9]{0,8}([0-9][0-9.,]*)/i);
  return any ? parseMoney(any[1]) : null;
}

/** Proof-of-payment reference from the validation stamp: `<date>-<time>-<trace>`. */
function findOncolReference(text: string): string {
  const stamp = text.match(
    /(\d{1,2}[A-Za-z]{3}\d{4})\s+(\d{1,2}:\d{2}:\d{2})\s+(\d{3,8})/,
  );
  if (stamp) {
    return `${stamp[1].toUpperCase()}-${stamp[2].replace(/:/g, "")}-${stamp[3]}`;
  }
  const loose = text.match(/(\d{1,2}[A-Za-z]{3}\d{4})\s+(\d{1,2}:\d{2}:\d{2})/);
  if (loose) return `${loose[1].toUpperCase()}-${loose[2].replace(/:/g, "")}`;
  return "";
}

function parseOncol(text: string): ParsedDoc {
  const agentRaw =
    findLabelledAgent(text, /AGENT\s*CODE/i) ?? findDashedAgent(text) ?? "";
  const date = findOncolDate(text);
  const amount = findOncolAmount(text);
  const reference = findOncolReference(text);
  return buildParsed("oncol", agentRaw, date, amount, reference, text);
}

// ---------------------------------------------------------------------------
// EPP confirmation (lbp-eservices screenshot) — DEPOSIT. Clean digital text.
// ---------------------------------------------------------------------------

function findEppDate(text: string): string {
  const dt = text.match(/DATE\s*AND\s*TIME[^0-9]*(\d{4})-(\d{2})-(\d{2})/i);
  if (dt) return `${dt[1]}-${dt[2]}-${dt[3]}`;
  const slash = text.match(/\bDATE\b[^0-9]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (slash) {
    const iso = toISODate(slash[1]);
    if (iso) return iso;
  }
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : "";
}

function findEppAmount(text: string): number | null {
  const total = text.match(/TOTAL\s*AMOUNT[^0-9]*([0-9][0-9.,]*)/i);
  if (total) {
    const n = parseMoney(total[1]);
    if (n != null) return n;
  }
  const any = text.match(/\bAMOUNT\b[^0-9]{0,8}([0-9][0-9.,]*)/i);
  return any ? parseMoney(any[1]) : null;
}

function findEppReference(text: string): string {
  const ref = text.match(/REFERENCE\s*NUMBER[^0-9A-Za-z]*([0-9][0-9A-Za-z-]{6,})/i);
  if (ref) return ref[1].replace(/[^0-9A-Za-z-]/g, "").toUpperCase();
  const conf = text.match(/CONFIRMATION\s*NO[^0-9]*([0-9]{8,})/i);
  return conf ? conf[1] : "";
}

function parseEpp(text: string): ParsedDoc {
  const agentRaw =
    findLabelledAgent(text, /AGENCY\s*NO/i) ?? findDashedAgent(text) ?? "";
  const date = findEppDate(text);
  const amount = findEppAmount(text);
  const reference = findEppReference(text);
  return buildParsed("epp", agentRaw, date, amount, reference, text);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function parseNormalized(text: string, docType: DocType): ParsedDoc {
  switch (docType) {
    case "report":
      return parseReport(text);
    case "oncol":
      return parseOncol(text);
    case "epp":
      return parseEpp(text);
  }
}

/** Parse already-known-typed OCR text into a ParsedDoc. */
export function parseAs(rawText: string, docType: DocType): ParsedDoc {
  return parseNormalized(normalize(rawText), docType);
}

/** Classify then parse one OCR text. `docType === null` means unrecognized. */
export function parseDocument(rawText: string): ParsedDoc {
  const text = normalize(rawText);
  const { type } = classifyDoc(text);
  if (!type) {
    return {
      docType: null,
      valid: false,
      agentNumber: "",
      agentKey: "",
      date: "",
      amount: null,
      reference: "",
      reason: "not one of the three accepted documents",
      raw: rawText,
    };
  }
  return parseNormalized(text, type);
}
