import { formatAgent } from "./agent";
import { MIN_SCORE, scoreDoc } from "./classify";
import { parseMoney } from "./money";
import { parseAs } from "./parse";
import { preprocess, type PreprocessMode } from "./preprocess";
import type { DocType, ParsedDoc } from "./types";

export type ScanProgress = (fraction: number, label: string) => void;

// "red" reads the red channel to strip the pink watermark off the PCSO report.
const VARIANTS: PreprocessMode[] = ["adaptive", "binary", "gray", "red"];

/** Count of the three required fields that parsed. */
export function fieldScore(p: ParsedDoc): number {
  return (p.agentKey ? 1 : 0) + (p.date ? 1 : 0) + (p.amount != null ? 1 : 0);
}

/** Most frequent non-empty value; ties go to the earliest (highest-priority) variant. */
function vote(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

const unrecognized = (raw: string): ParsedDoc => ({
  docType: null,
  valid: false,
  agentNumber: "",
  agentKey: "",
  date: "",
  amount: null,
  reference: "",
  reason: "not one of the three accepted documents",
  raw,
});

/**
 * Combine the per-variant OCR texts at one orientation: pick the document type
 * by summed keyword score across variants, then vote each field across the
 * variant parses (different enhancements misread different characters). Exported
 * so the Node OCR harness (scripts/ocr-samples.ts) shares the exact same logic.
 */
export function combineTexts(texts: string[]): ParsedDoc {
  const agg: Record<DocType, number> = { report: 0, oncol: 0, epp: 0 };
  for (const t of texts) {
    const s = scoreDoc(t);
    agg.report += s.report;
    agg.oncol += s.oncol;
    agg.epp += s.epp;
  }

  let type: DocType | null = null;
  let bestScore = 0;
  (Object.keys(agg) as DocType[]).forEach((k) => {
    if (agg[k] > bestScore) {
      type = k;
      bestScore = agg[k];
    }
  });
  const raw = texts.join("\n--- variant ---\n");
  if (!type || bestScore < MIN_SCORE) return unrecognized(raw);
  const docType = type as DocType;

  const parses = texts.map((t) => parseAs(t, docType));
  const agentKey = vote(parses.map((p) => p.agentKey));
  const date = vote(parses.map((p) => p.date));
  const amountStr = vote(parses.map((p) => (p.amount != null ? String(p.amount) : "")));
  const reference = vote(parses.map((p) => p.reference));
  const amount = amountStr ? parseMoney(amountStr) : null;

  const missing = [
    !agentKey && "agent number",
    !date && "date",
    amount == null && "amount",
  ].filter((x): x is string => Boolean(x));

  return {
    docType,
    valid: missing.length === 0,
    agentNumber: agentKey ? formatAgent(agentKey) : vote(parses.map((p) => p.agentNumber)),
    agentKey,
    date,
    amount,
    reference,
    reason: missing.length ? `couldn't read ${missing.join(", ")}` : "",
    raw,
  };
}

type RecognizeFn = (canvas: HTMLCanvasElement) => Promise<string>;

/** OCR all three enhanced variants at one orientation and combine. */
async function scanOrientation(
  recognize: RecognizeFn,
  file: File,
  deg: number,
): Promise<ParsedDoc> {
  const texts: string[] = [];
  for (const mode of VARIANTS) {
    const canvas = await preprocess(file, mode, deg);
    texts.push(await recognize(canvas));
  }
  return combineTexts(texts);
}

/**
 * OCR a PCSO document photo. Scans upright first (3 enhanced variants, classified
 * and voted per field); if that doesn't yield a confident read, retries at
 * 90/270/180° for sideways photos. Returns the first valid result, else the best
 * partial one (which may be `docType: null` for an unrecognized image). A single
 * Tesseract worker is reused for every pass and loaded lazily so it never touches
 * the server bundle.
 */
export async function scanDocument(
  file: File,
  onProgress?: ScanProgress,
): Promise<ParsedDoc> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        onProgress?.(m.progress, "Reading document");
      } else {
        onProgress?.(0, "Preparing OCR engine");
      }
    },
  });
  const recognize: RecognizeFn = async (canvas) =>
    (await worker.recognize(canvas)).data.text;

  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    // Upright first. A valid read, or one that found ≥2 fields, means the photo
    // is oriented correctly — return it rather than risk rotating into garbage.
    const upright = await scanOrientation(recognize, file, 0);
    if (upright.valid || fieldScore(upright) >= 2) return upright;

    let best = upright;
    for (const deg of [90, 270, 180]) {
      onProgress?.(0, "Trying a rotated angle");
      const result = await scanOrientation(recognize, file, deg);
      if (result.valid) return result;
      if (fieldScore(result) > fieldScore(best)) best = result;
    }
    return best;
  } finally {
    await worker.terminate();
  }
}
