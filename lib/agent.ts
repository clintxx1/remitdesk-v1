/** Strip everything but digits — the stable key that unifies an agent across docs. */
export function normalizeAgentKey(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

/**
 * Display form of an agent number. An 8-digit code is shown grouped 3-4-1
 * (e.g. "41301333" -> "413-0133-3") to match how it prints on the report and
 * ONCOL slip; anything else falls back to the bare digits.
 */
export function formatAgent(raw: string): string {
  const d = normalizeAgentKey(raw);
  if (d.length === 8) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  return d || (raw ?? "").trim();
}
