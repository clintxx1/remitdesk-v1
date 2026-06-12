import { cn } from "@/lib/cn";
import { DOC_TAGS, type DocType } from "@/lib/types";

const STYLES: Record<DocType, string> = {
  report: "bg-amber-50 text-amber-700 ring-amber-200",
  oncol: "bg-teal-50 text-teal-700 ring-teal-200",
  epp: "bg-sky-50 text-sky-700 ring-sky-200",
};

/** Colored chip for a document type — amber = liability, teal/sky = deposit. */
export function DocBadge({ docType, className }: { docType: DocType; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        STYLES[docType],
        className,
      )}
    >
      {DOC_TAGS[docType]}
    </span>
  );
}
