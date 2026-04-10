export function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export function formatPercent(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

export function formatGrowth(rate: number): string {
  const pct = (rate * 100).toFixed(1);
  return rate >= 0 ? `+${pct}%` : `${pct}%`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

export function humanizeSlug(slug: string): string {
  if (!slug) return "Other";
  return slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .replace(/ And /g, " & ");
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return "";
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    ...Array.from(upper).map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

const COUNTRY_NAMES: Record<string, string> = {
  CN: "China", KR: "South Korea", JP: "Japan", US: "United States",
  TW: "Taiwan", DE: "Germany", GB: "United Kingdom", FR: "France",
  SE: "Sweden", NL: "Netherlands", SG: "Singapore", HK: "Hong Kong",
  CA: "Canada", AU: "Australia", IL: "Israel", IN: "India",
  IT: "Italy", ES: "Spain", BR: "Brazil", MX: "Mexico",
};

export function countryName(code: string): string {
  return COUNTRY_NAMES[code?.toUpperCase()] || code?.toUpperCase() || "";
}
