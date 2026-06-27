// Vogara Nova brand baseline for the Portfolio Health executive cockpit.
// Navy is the signature surface colour; greys carry structure and text.
// RAG colours are reserved EXCLUSIVELY for status communication.

export const VOGARA = {
  navy: "#003968",
  navyDeep: "#002847",
  graphite: "#63666F",
  mist: "#D0D1DB",
  white: "#FFFFFF",
} as const;

export type Rag = "green" | "amber" | "red" | "gray";

export const RAG_COLOR: Record<Rag, string> = {
  green: "#16a34a",
  amber: "#f59e0b",
  red: "#ef4444",
  gray: "#9ca3af",
};

export const RAG_LABEL: Record<Rag, string> = {
  green: "On Track",
  amber: "At Risk",
  red: "Critical",
  gray: "Insufficient Data",
};

export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "\u2014";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "\u2014";
  return `${value}%`;
}
