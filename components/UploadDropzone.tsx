"use client";

import { useCallback, useRef, useState } from "react";
import { FileCheck2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";

type Props = {
  onFiles: (files: File[]) => void;
  busy?: boolean;
};

/** Multi-file drag-and-drop / browse. Non-image files are rejected with a toast. */
export function UploadDropzone({ onFiles, busy = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const all = Array.from(list);
      const images = all.filter((f) => f.type.startsWith("image/"));
      const rejected = all.length - images.length;
      if (rejected > 0) {
        toast.error(`Skipped ${rejected} non-image file${rejected > 1 ? "s" : ""}`, {
          description: "Upload photos or screenshots (PNG, JPG, WEBP) of the documents.",
        });
      }
      if (images.length) onFiles(images);
    },
    [onFiles],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handle(e.dataTransfer.files);
      }}
      className={cn(
        "group relative flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors",
        dragging
          ? "border-indigo-500 bg-indigo-50"
          : "border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/bmp"
        multiple
        className="hidden"
        onChange={(e) => {
          handle(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 transition-transform group-hover:scale-105">
        <UploadCloud className="h-6 w-6" />
      </div>
      <p className="text-base font-semibold text-slate-800">
        Drop documents to scan{busy ? " — adding more is fine" : ""}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        or <span className="font-medium text-indigo-600">browse</span> · select
        several at once · PNG, JPG, WEBP
      </p>
      <p className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs text-slate-400">
        <FileCheck2 className="h-3.5 w-3.5" />
        Accepts Total Current Day report, ONCOL slip &amp; EPP confirmation
      </p>
    </div>
  );
}
