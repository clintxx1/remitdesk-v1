import { formatAgent, normalizeAgentKey } from "@/lib/agent";
import { toISODate } from "@/lib/date";
import { parseMoney } from "@/lib/money";
import type { ParsedDoc } from "@/lib/types";

export const runtime = "nodejs";

// Any free-tier vision model from Google AI Studio works; override with GEMINI_MODEL.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const PROMPT = `You are extracting structured data from a photo of a Philippine PCSO lotto-agent document.

There are exactly THREE valid document types:
- "report": a "TOTAL CURRENT DAY" thermal receipt. It has TERMINAL ID, AGENCY ID, lines for SALES / CANCELS / PAYOUTS / COMMIS / WTAX / DST, and a NET total at the bottom. It is often printed over a faint pink/rose watermark.
- "oncol": a LandBank "ONCOLL PAYMENT SLIP" deposit slip. Some fields are handwritten. There is a machine-printed validation stamp (often faint dot-matrix) containing AGENT CODE, AMOUNT PHP, and a date/time/trace number.
- "epp": an "lbp-eservices" / "PHILIPPINE CHARITY SWEEPSTAKES ... LOTTO REMITTANCE" payment confirmation screenshot. It has Agency No., TOTAL AMOUNT, Reference Number, and Confirmation No.

If the image is none of these three, set docType to "unknown" and leave every other field as "".

Extract these fields:
- agentNumber: the lotto agent's number/code.
  - report -> the AGENCY ID (e.g. "413-0133-3")
  - oncol  -> the AGENT CODE in the validation stamp (e.g. "41301333"); if you truly cannot read it, use the handwritten "Reference Number 2".
  - epp    -> the Agency No. (e.g. "41301180")
- date: the document date, normalized to ISO "YYYY-MM-DD".
  - report -> the receipt date (e.g. 28MAY26 -> "2026-05-28")
  - oncol  -> the validation-stamp date (e.g. 29MAY2026 -> "2026-05-29")
  - epp    -> the Date / Date and Time (e.g. 06/09/2026 -> "2026-06-09"; 06/09/2026 is MM/DD/YYYY = June 9)
- amount: the peso amount as a plain number string - no "PHP", no currency sign, no thousands commas. e.g. "11159.42". If the amount is negative, include a leading minus (e.g. "-1234.56") - a report NET can be negative when payouts/cancels exceed sales. Deposits (oncol, epp) are always positive.
  - report -> the NET amount (may be negative)
  - oncol  -> the deposit AMOUNT (prefer the stamped "AMOUNT PHP ...")
  - epp    -> the TOTAL AMOUNT
- reference: proof-of-payment reference. "" for a report.
  - oncol -> the validation stamp's date+time+trace joined with dashes, e.g. "29MAY2026-095115-000052"
  - epp   -> the Reference Number, e.g. "4542-06092026-335118"

Read handwriting and faint dot-matrix stamps as carefully as you can. If a single field genuinely cannot be determined, return "" for it - do NOT invent a value.

Return ONLY a JSON object with exactly these keys: docType, agentNumber, date, amount, reference.`;

type GeminiOut = {
  docType?: string;
  agentNumber?: string;
  date?: string;
  amount?: string | number;
  reference?: string;
};

/** Map the model's JSON into the same ParsedDoc shape the Tesseract path returns. */
function toParsedDoc(m: GeminiOut, raw: string): ParsedDoc {
  const docType = (["report", "oncol", "epp"] as const).find((t) => t === m.docType) ?? null;
  if (!docType) {
    return {
      docType: null,
      valid: false,
      agentNumber: "",
      agentKey: "",
      date: "",
      amount: null,
      reference: "",
      reason: "not one of the three accepted documents",
      raw,
    };
  }
  const agentRaw = String(m.agentNumber ?? "").trim();
  const agentKey = normalizeAgentKey(agentRaw);
  const dRaw = String(m.date ?? "").trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dRaw) ? dRaw : toISODate(dRaw);
  const amt = parseMoney(m.amount);
  // A report NET may be negative; a deposit is always positive.
  const amount = amt == null ? null : docType === "report" ? amt : Math.abs(amt);
  const reference = docType === "report" ? "" : String(m.reference ?? "").trim();

  const missing: string[] = [];
  if (!agentKey) missing.push("agent number");
  if (!date) missing.push("date");
  if (amount == null) missing.push("amount");

  return {
    docType,
    valid: missing.length === 0,
    agentNumber: agentKey ? formatAgent(agentRaw) : "",
    agentKey,
    date,
    amount,
    reference,
    reason: missing.length ? `couldn't read ${missing.join(", ")}` : "",
    raw,
  };
}

function parseModelJson(text: string): GeminiOut {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse((fence ? fence[1] : text).trim());
}

// Gemini's free tier occasionally returns 503 ("high demand") or 429 (quota) on a
// spike; these are transient, so retry with backoff before giving up. An optional
// GEMINI_FALLBACK_MODEL is tried if the primary model stays overloaded.
const RETRYABLE = new Set([429, 500, 503]);
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "";
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

type GeminiResult =
  | { ok: true; text: string }
  | { ok: false; status: number; detail: string };

/** Call one model, retrying transient overload/quota errors with backoff. */
async function callGemini(model: string, key: string, body: unknown): Promise<GeminiResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  let status = 0;
  let detail = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const j = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        return { ok: true, text: j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "" };
      }
      status = res.status;
      detail = (await res.text().catch(() => "")).slice(0, 300);
      if (!RETRYABLE.has(status)) break;
    } catch (e) {
      status = 0;
      detail = String(e);
    }
    if (attempt < 2) await sleep(600 * (attempt + 1)); // 600ms, then 1200ms
  }
  return { ok: false, status, detail };
}

/** Lets the client know whether AI extraction is available (no secret leaked). */
export function GET() {
  return Response.json({ configured: Boolean(process.env.GEMINI_API_KEY), model: MODEL });
}

export async function POST(req: Request): Promise<Response> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "not_configured" }, { status: 503 });

  let image = "";
  try {
    const body = (await req.json()) as { image?: string };
    image = body.image ?? "";
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const m = /^data:(.+?);base64,([\s\S]*)$/.exec(image || "");
  if (!m) return Response.json({ error: "bad_image" }, { status: 400 });
  const [, mimeType, data] = m;

  const body = {
    contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data } }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  };

  // Configured model first; fall back to GEMINI_FALLBACK_MODEL only on a transient overload.
  const models = FALLBACK_MODEL && FALLBACK_MODEL !== MODEL ? [MODEL, FALLBACK_MODEL] : [MODEL];
  let result: GeminiResult = { ok: false, status: 0, detail: "no attempt" };
  for (const model of models) {
    result = await callGemini(model, key, body);
    if (result.ok) break;
    const transient = result.status === 0 || RETRYABLE.has(result.status);
    if (!transient) break; // 400/403/404 etc. — another model won't help
  }
  if (!result.ok) {
    return Response.json(
      { error: "gemini_error", status: result.status, detail: result.detail },
      { status: 502 },
    );
  }

  let parsed: GeminiOut;
  try {
    parsed = parseModelJson(result.text);
  } catch {
    return Response.json({ error: "parse_error", detail: result.text.slice(0, 500) }, { status: 502 });
  }
  return Response.json(toParsedDoc(parsed, result.text));
}
