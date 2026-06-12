import type { DocType } from "./types";

/**
 * Keyword signals per document type. Each is tested against the OCR text;
 * matches add their weight. Distinctive headers (e.g. "TOTAL CURRENT DAY",
 * "ONCOLL", "LOTTO REMITTANCE") carry the most weight so a single confident
 * anchor is enough to identify the document even when the rest is noisy.
 */
type Signal = { re: RegExp; weight: number };

function sig(pattern: string, weight = 1): Signal {
  // Allow flexible whitespace (incl. OCR line breaks) between words.
  return { re: new RegExp(pattern.replace(/ +/g, "\\s+"), "i"), weight };
}

const SIGNALS: Record<DocType, Signal[]> = {
  report: [
    sig("TOTAL CURRENT DAY", 3),
    sig("TERMINAL ID", 2),
    sig("AGENCY ID", 2),
    // Tokens that survive OCR on the watermarked thermal receipt even when the
    // multi-word headers don't. PAYOUTS + TERMINAL alone reach the threshold and
    // never appear on an ONCOL slip or EPP screenshot.
    sig("PAYOUTS", 2),
    sig("\\bTERMINAL\\b", 1),
    sig("CANCELS", 1),
    sig("COMMIS", 1),
    sig("WTAX", 1),
    sig("\\bDST\\b", 1),
    sig("\\bPCSO\\b", 1),
    sig("\\bSALES\\b", 1),
  ],
  oncol: [
    sig("ONCOLL", 3),
    sig("PAYMENT SLIP", 2),
    sig("AGENT CODE", 2),
    sig("DEPOSIT ACCOUNT", 2),
    sig("DEBIT FROM ACCOUNT", 1),
    sig("\\bMERCHANT\\b", 1),
    sig("\\bVALIDATION\\b", 1),
    sig("LANDBANK", 1),
  ],
  epp: [
    sig("LOTTO REMITTANCE", 3),
    sig("SWEEPSTAKES", 2),
    sig("CONFIRMATION NO", 2),
    sig("AGENCY NO", 2),
    sig("TOTAL AMOUNT", 2),
    sig("PAYMENT OPTION", 1),
    sig("ESERVICES", 1),
    sig("SUCCESSFULLY", 1),
  ],
};

/** Lowest combined score (across however many variants are summed) to accept a type. */
export const MIN_SCORE = 3;

/** Per-type keyword score for a single OCR text. */
export function scoreDoc(text: string): Record<DocType, number> {
  const scores: Record<DocType, number> = { report: 0, oncol: 0, epp: 0 };
  (Object.keys(SIGNALS) as DocType[]).forEach((type) => {
    for (const s of SIGNALS[type]) {
      if (s.re.test(text)) scores[type] += s.weight;
    }
  });
  return scores;
}

export type Classification = {
  type: DocType | null;
  scores: Record<DocType, number>;
};

/** Classify one OCR text into a document type, or null when none is confident. */
export function classifyDoc(text: string): Classification {
  const scores = scoreDoc(text);
  let best: DocType | null = null;
  let bestScore = 0;
  (Object.keys(scores) as DocType[]).forEach((type) => {
    if (scores[type] > bestScore) {
      best = type;
      bestScore = scores[type];
    }
  });
  return { type: bestScore >= MIN_SCORE ? best : null, scores };
}
