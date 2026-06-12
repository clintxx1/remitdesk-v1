/**
 * Parser fixtures — validates classification + field extraction for the three
 * document types (and rejection of anything else) against representative OCR
 * text, without needing real image files. Run with `npm test`.
 */
import { parseMoney } from "../lib/money";
import { parseDocument } from "../lib/parse";
import type { DocType } from "../lib/types";

type Expect = {
  docType: DocType | null;
  agentKey?: string;
  date?: string;
  amount?: number | null;
  reference?: string;
};

type Case = { name: string; text: string; expect: Expect };

const REPORT = `TOTAL CURRENT DAY
PCSO
TERMINAL ID            2C1A
28MAY26               19:15
AGENCY ID        413-0133-3

SALES               11533.12
CANCELS                 0.00
PAYOUTS                 0.00
COMMIS.              674.32-
WTAX                   33.74
DST                   266.88
--------------------------------
NET                 11159.42`;

const ONCOL = `ONCOLL PAYMENT SLIP          LANDBANK
Please check the appropriate mode of payment.
CASH   CHECK   DEBIT FROM ACCOUNT
DATE  may 29, 2026
MERCHANT / AGENCY DEPOSIT ACCOUNT NUMBER   1192222008
MERCHANT / AGENCY NAME    PCSO
Reference Number 1   Fernando Uy
Reference Number 2   413-0133-3
Reference Number 3 (Numeric)
Amount    11,160 -
Validation 29MAY2026 09:51:15 000052 2KC1 Rwg Pyal Coll
BRANCH NAME   0119
INSTITUTION NAME   PCSO - Northern Samar
CLRAB ACCT NO   1192222008
NAME OF AGENT   UY FERNANDO
AGENT CODE   41301333
AMOUNT   PHP 11,160.00
0.00`;

const EPP = `PHILIPPINE CHARITY SWEEPSTAKES OFFICE - NORTHERN SAMAR BRANCH - LOTTO REMITTANCE
You have SUCCESSFULLY paid Lotto Remittance to PHILIPPINE CHARITY SWEEPSTAKES OFFICE - NORTHERN SAMAR BRANCH with the following details:
Date   06/09/2026
Agency No.   41301180
Agency Name   Lyubim Lovino
Account No.   1192222008
Payment Option   LANDBANK/OFBank ATM Card
Amount   PHP 17,400.00
LBP Fee   PHP 0.00
TOTAL AMOUNT   PHP 17,400.00
Reference Number   4542-06092026-335118
Date and Time   2026-06-09 18:57:31
Confirmation No.   00006092026185731563`;

const REPORT_NEG = `TOTAL CURRENT DAY
PCSO
TERMINAL ID            2C1A
03JUN26               20:10
AGENCY ID        413-0133-3
SALES                1200.00
CANCELS                 0.00
PAYOUTS              5000.00
COMMIS.              120.00-
WTAX                   5.00
DST                   10.00
--------------------------------
NET                 2345.67-`;

const GROCERY = `SUPER GROCERY MART
OR No. 998877
Item A          50.00
Item B         120.00
TOTAL          170.00
CASH           200.00
CHANGE          30.00
THANK YOU FOR SHOPPING`;

const CASES: Case[] = [
  {
    name: "Total Current Day report",
    text: REPORT,
    expect: { docType: "report", agentKey: "41301333", date: "2026-05-28", amount: 11159.42, reference: "" },
  },
  {
    name: "Total Current Day report (negative NET — PCSO owes agent)",
    text: REPORT_NEG,
    expect: { docType: "report", agentKey: "41301333", date: "2026-06-03", amount: -2345.67, reference: "" },
  },
  {
    name: "ONCOL payment slip",
    text: ONCOL,
    expect: {
      docType: "oncol",
      agentKey: "41301333",
      date: "2026-05-29",
      amount: 11160,
      reference: "29MAY2026-095115-000052",
    },
  },
  {
    name: "EPP confirmation",
    text: EPP,
    expect: {
      docType: "epp",
      agentKey: "41301180",
      date: "2026-06-09",
      amount: 17400,
      reference: "4542-06092026-335118",
    },
  },
  {
    name: "Unrelated grocery receipt",
    text: GROCERY,
    expect: { docType: null },
  },
];

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  if (actual === expected) {
    console.log(`    ✓ ${label} = ${JSON.stringify(actual)}`);
  } else {
    failures++;
    console.log(`    ✗ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

for (const c of CASES) {
  console.log(`\n• ${c.name}`);
  const parsed = parseDocument(c.text);
  check("docType", parsed.docType, c.expect.docType);
  if (c.expect.agentKey !== undefined) check("agentKey", parsed.agentKey, c.expect.agentKey);
  if (c.expect.date !== undefined) check("date", parsed.date, c.expect.date);
  if (c.expect.amount !== undefined) check("amount", parsed.amount, c.expect.amount);
  if (c.expect.reference !== undefined) check("reference", parsed.reference, c.expect.reference);
}

console.log("\n• parseMoney signs");
check("leading minus", parseMoney("-1000"), -1000);
check("trailing accounting minus", parseMoney("11,159.42-"), -11159.42);
check("parentheses", parseMoney("(500)"), -500);
check("plain positive", parseMoney("11,160"), 11160);
check("PHP positive", parseMoney("PHP 17,400.00"), 17400);

console.log(failures === 0 ? "\nAll parser checks passed ✅" : `\n${failures} check(s) failed ❌`);
process.exit(failures === 0 ? 0 : 1);
