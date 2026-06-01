export function inr(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  if (!isFinite(v)) return "₹0";
  return "₹" + Math.round(v).toLocaleString("en-IN");
}

export function inrPrecise(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  if (!isFinite(v)) return "₹0.00";
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * International currency formatter. Uses Intl.NumberFormat with currency-aware
 * rounding (e.g. JPY has 0 decimals, USD/EUR/INR show 2).
 */
export function money(
  n: number | string | null | undefined,
  currency: string = "INR",
  locale?: string,
  opts: { precise?: boolean } = {},
): string {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  if (!isFinite(v)) return new Intl.NumberFormat(locale, { style: "currency", currency }).format(0);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: opts.precise ? 2 : 0,
      minimumFractionDigits: opts.precise ? 2 : 0,
    }).format(opts.precise ? v : Math.round(v));
  } catch {
    return `${currency} ${v.toFixed(opts.precise ? 2 : 0)}`;
  }
}

export function shortDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function fullDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(Math.round((a.getTime() - b.getTime()) / 86400000));
}