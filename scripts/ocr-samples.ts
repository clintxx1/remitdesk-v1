/**
 * Real-image OCR harness — runs the exact browser pipeline (preprocess + 3-variant
 * voting + orientation trial via lib/ocr's combineTexts) on every image in
 * ./samples and checks the extracted fields against what each document should
 * yield. Mirrors lib/ocr.ts scanDocument, but with @napi-rs/canvas standing in
 * for the browser canvas so it can run under Node.
 *
 *   npm run ocr                 # all samples, pass/fail per field
 *   npm run ocr -- oncol --raw  # filter by name, dump the raw OCR text
 */
import fs from "node:fs";
import path from "node:path";
import { createCanvas, type Image, loadImage } from "@napi-rs/canvas";
import { createWorker, PSM, type Worker } from "tesseract.js";
import { combineTexts, fieldScore } from "../lib/ocr";
import { enhance, type PreprocessMode } from "../lib/preprocess";
import type { DocType } from "../lib/types";

const DIR = path.join(process.cwd(), "samples");
const VARIANTS: PreprocessMode[] = ["adaptive", "binary", "gray", "red"];

type Expected = {
  docType: DocType;
  agentKey: string;
  date: string;
  amount: number;
  reference?: string;
  /**
   * "auto"   — must fully auto-extract every field (the clean EPP screenshot).
   * "review" — Tesseract can't reliably read this document (watermark / faint
   *            stamp / handwriting), so the bar is: classify it correctly AND
   *            never emit a wrong value — a field is either correct or left blank
   *            for the user to fill. A confidently-wrong value is a failure.
   */
  mode: "auto" | "review";
};

const EXPECT: Record<string, Expected> = {
  TOTAL_CURRENT_DAY_REPORT: {
    docType: "report",
    agentKey: "41301333",
    date: "2026-05-28",
    amount: 11159.42,
    mode: "review",
  },
  ONCOL_PAYMENT: {
    docType: "oncol",
    agentKey: "41301333",
    date: "2026-05-29",
    amount: 11160,
    reference: "29MAY2026-095115-000052",
    mode: "review",
  },
  EPP_PAYMENT: {
    docType: "epp",
    agentKey: "41301180",
    date: "2026-06-09",
    amount: 17400,
    reference: "4542-06092026-335118",
    mode: "auto",
  },
};

/** Node equivalent of lib/preprocess.preprocess(): upscale, rotate, enhance. */
function buildBuffer(img: Image, mode: PreprocessMode, deg: number): Buffer {
  const baseW = img.width;
  const baseH = img.height;
  const targetW = Math.min(2200, Math.max(1500, baseW));
  const scale = targetW / baseW;
  const dw = Math.round(baseW * scale);
  const dh = Math.round(baseH * scale);
  const rot = ((deg % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const cw = swap ? dh : dw;
  const ch = swap ? dw : dh;

  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext("2d");
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const image = ctx.getImageData(0, 0, cw, ch);
  enhance(image.data as unknown as Uint8ClampedArray, cw, ch, mode);
  ctx.putImageData(image, 0, 0);
  return canvas.toBuffer("image/png");
}

async function recognize(worker: Worker, buf: Buffer): Promise<string> {
  return (await worker.recognize(buf)).data.text;
}

async function scanOrientation(worker: Worker, img: Image, deg: number) {
  const texts: string[] = [];
  for (const mode of VARIANTS) texts.push(await recognize(worker, buildBuffer(img, mode, deg)));
  return { combined: combineTexts(texts), raw: texts.join("\n--- variant ---\n") };
}

async function scan(worker: Worker, img: Image) {
  const upright = await scanOrientation(worker, img, 0);
  if (upright.combined.valid || fieldScore(upright.combined) >= 2) return { deg: 0, ...upright };
  let best = { deg: 0, ...upright };
  for (const deg of [90, 270, 180]) {
    const r = await scanOrientation(worker, img, deg);
    if (r.combined.valid) return { deg, ...r };
    if (fieldScore(r.combined) > fieldScore(best.combined)) best = { deg, ...r };
  }
  return best;
}

const tick = (ok: boolean) => (ok ? "✓" : "✗");

(async () => {
  const showRaw = process.argv.includes("--raw");
  const filter = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  let files = fs.readdirSync(DIR).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
  if (filter.length) {
    files = files.filter((f) => filter.some((a) => f.toLowerCase().includes(a.toLowerCase())));
  }

  const worker = await createWorker("eng", 1, { logger: () => {} });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });

  let failures = 0;
  for (const f of files) {
    const base = f.replace(/\.(jpe?g|png)$/i, "");
    const exp = EXPECT[base];
    const img = await loadImage(path.join(DIR, f));
    const { deg, combined: c, raw } = await scan(worker, img);

    // Per-field status. In review mode an empty field is acceptable ("review");
    // a non-empty value must be correct or it's flagged as GARBAGE.
    const fieldStatus = (got: string, want: string): string => {
      if (!got) return exp.mode === "review" ? "· needs review" : `✗ want ${want}`;
      return got === want ? "✓" : `✗ GARBAGE (want ${want})`;
    };
    const agentS = fieldStatus(c.agentKey, exp.agentKey);
    const dateS = fieldStatus(c.date, exp.date);
    const amountS = fieldStatus(c.amount == null ? "" : String(c.amount), String(exp.amount));
    const refS = exp.reference ? fieldStatus(c.reference, exp.reference) : "";
    const recognized = c.docType === exp.docType;
    const noGarbage = ![agentS, dateS, amountS, refS].some((s) => s.includes("GARBAGE"));
    const fullyExtracted = [agentS, dateS, amountS, refS].every((s) => s === "✓" || s === "");

    const pass = exp.mode === "auto" ? recognized && fullyExtracted : recognized && noGarbage;
    if (!pass) failures++;

    const note = exp.mode === "review" ? "  [review doc — recognize + no garbage]" : "  [auto-extract]";
    console.log(`\n${pass ? "PASS" : "FAIL"}  ${f}   (rot=${deg})${note}`);
    console.log(`   docType:   ${String(c.docType)}   want ${exp.docType} ${tick(recognized)}`);
    console.log(`   agentKey:  ${(c.agentKey || "-").padEnd(12)} ${agentS}`);
    console.log(`   date:      ${(c.date || "-").padEnd(12)} ${dateS}`);
    console.log(`   amount:    ${String(c.amount ?? "-").padEnd(12)} ${amountS}`);
    console.log(`   reference: ${(c.reference || "-").padEnd(24)} ${refS}`);
    if (!pass || showRaw) {
      console.log("   --- raw OCR (voted across 3 variants) ---");
      console.log(
        raw
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => "      " + l)
          .join("\n"),
      );
    }
  }

  await worker.terminate();
  console.log(
    `\n${files.length - failures}/${files.length} samples OK ` +
      `(EPP auto-extracts; report & ONCOL are recognized for manual review, no garbage)`,
  );
  process.exit(failures ? 1 : 0);
})();
