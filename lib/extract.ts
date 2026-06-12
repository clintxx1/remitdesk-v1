import type { ParsedDoc } from "./types";

// Cap the longest edge before upload: keeps faint-stamp detail while bounding the
// request size. Phone photos are usually 3000–4000px; this only shrinks big ones.
const MAX_DIM = 2600;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read image"));
    r.readAsDataURL(blob);
  });
}

/** Read a File into a (optionally downscaled) data URL for upload. */
async function toUploadDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not load image"));
      i.src = url;
    });
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const scale = Math.min(1, MAX_DIM / Math.max(w, h));
    if (scale === 1 && file.type === "image/jpeg") return blobToDataUrl(file);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return blobToDataUrl(file);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Whether the server has a GEMINI_API_KEY (so AI extraction is available). */
export async function checkGeminiConfigured(): Promise<boolean> {
  try {
    const r = await fetch("/api/extract", { method: "GET" });
    if (!r.ok) return false;
    const d: unknown = await r.json();
    return Boolean((d as { configured?: boolean })?.configured);
  } catch {
    return false;
  }
}

/** Extract a document via the Gemini route. Throws on any failure so the caller
 *  can fall back to Tesseract. */
export async function extractWithGemini(file: File): Promise<ParsedDoc> {
  const image = await toUploadDataUrl(file);
  const r = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`AI extract failed (${r.status}): ${detail.slice(0, 200)}`);
  }
  return (await r.json()) as ParsedDoc;
}
