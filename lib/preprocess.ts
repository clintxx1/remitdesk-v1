export type PreprocessMode = "adaptive" | "binary" | "gray" | "red";

/**
 * Adaptive (local-mean) threshold via an integral image. For each pixel we
 * compare it to the average of its neighbourhood minus a constant — this copes
 * with the uneven fading and watermark of thermal receipts far better than a
 * single global cutoff.
 */
function adaptiveThreshold(
  d: Uint8ClampedArray,
  lum: Float32Array,
  w: number,
  h: number,
): void {
  const iw = w + 1;
  const integral = new Float64Array(iw * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    const rowBase = y * w;
    const intRow = (y + 1) * iw;
    const intPrev = y * iw;
    for (let x = 0; x < w; x++) {
      rowSum += lum[rowBase + x];
      integral[intRow + x + 1] = integral[intPrev + x + 1] + rowSum;
    }
  }

  const radius = Math.max(8, Math.round(w / 60));
  const C = 10;
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h, y + radius + 1);
    const rowBase = y * w;
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w, x + radius + 1);
      const area = (x1 - x0) * (y1 - y0);
      const sum =
        integral[y1 * iw + x1] -
        integral[y0 * iw + x1] -
        integral[y1 * iw + x0] +
        integral[y0 * iw + x0];
      const mean = sum / area;
      const v = lum[rowBase + x] < mean - C ? 0 : 255;
      const idx = (rowBase + x) * 4;
      d[idx] = v;
      d[idx + 1] = v;
      d[idx + 2] = v;
      d[idx + 3] = 255;
    }
  }
}

/**
 * In-place pixel enhancement (grayscale + one of four thresholding modes).
 * Pure — operates only on an RGBA buffer.
 *
 * The "red" mode reads only the red channel before adaptive thresholding: a
 * pink/red watermark (high red, ≈ paper white in that channel) all but vanishes
 * while dark text stays dark — essential for the watermarked PCSO report.
 */
export function enhance(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  mode: PreprocessMode,
): void {
  const redOnly = mode === "red";
  const lum = new Float32Array(w * h);
  let min = 255;
  let max = 0;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const l = redOnly ? d[i] : 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    lum[p] = l;
    if (l < min) min = l;
    if (l > max) max = l;
  }

  if (mode === "adaptive") {
    adaptiveThreshold(d, lum, w, h);
    return;
  }

  // "binary" and "red" hard-threshold after a contrast stretch; "gray" keeps the
  // stretched grayscale. A global threshold (not adaptive) is what lets the red
  // channel flatten the pink watermark to white instead of re-finding its edges.
  const range = Math.max(1, max - min);
  const THRESHOLD = 145;
  const hardThreshold = mode === "binary" || mode === "red";
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const stretched = ((lum[p] - min) / range) * 255;
    const v = hardThreshold ? (stretched < THRESHOLD ? 0 : 255) : stretched;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

/**
 * Prepare a document photo for OCR: upscale, optionally rotate by `rotateDeg`
 * (0/90/180/270, for sideways photos), then enhance for the chosen variant.
 */
export async function preprocess(
  file: File,
  mode: PreprocessMode,
  rotateDeg = 0,
): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const baseW = img.naturalWidth || img.width;
    const baseH = img.naturalHeight || img.height;
    if (!baseW || !baseH) throw new Error("Empty image");

    const targetW = Math.min(2200, Math.max(1500, baseW));
    const scale = targetW / baseW;
    const dw = Math.round(baseW * scale);
    const dh = Math.round(baseH * scale);

    const rot = (((rotateDeg % 360) + 360) % 360) as 0 | 90 | 180 | 270;
    const swap = rot === 90 || rot === 270;
    const cw = swap ? dh : dw;
    const ch = swap ? dw : dh;

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas is not supported in this browser");
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const image = ctx.getImageData(0, 0, cw, ch);
    enhance(image.data, cw, ch, mode);
    ctx.putImageData(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
