import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const norm = (s: string) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function monthKey(d: string | Date) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(k: string) {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

type ItemRow = {
  name: string;
  canonical_name: string | null;
  brand: string;
  qty: number | null;
  unit: string | null;
  unit_price: number | null;
  price: number | null;
  category: string;
  sub: string | null;
  bill_date: string;
  bill_id: string;
};

export const getInflation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const [itemsR, billsR] = await Promise.all([
      supabase
        .from("items")
        .select("name, canonical_name, brand, qty, unit, unit_price, price, category, sub, bill_date, bill_id")
        .eq("user_id", userId)
        .order("bill_date", { ascending: true }),
      supabase.from("bills").select("id, currency").eq("user_id", userId),
    ]);
    if (itemsR.error) throw new Error(itemsR.error.message);
    if (billsR.error) throw new Error(billsR.error.message);

    const items = (itemsR.data ?? []) as ItemRow[];
    const billCurrency = new Map((billsR.data ?? []).map((b) => [b.id, b.currency ?? "INR"]));

    const cm = new Map<string, number>();
    for (const [, c] of billCurrency) cm.set(c, (cm.get(c) ?? 0) + 1);
    const currency = [...cm.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "INR";

    // Build set of months covered (last 12)
    const now = new Date();
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const monthSet = new Set(months);

    // ---- Category monthly weighted-avg unit price ----
    // key: category -> month -> { sumPriceQty, sumQty, spent }
    type Cell = { sumUP: number; n: number; spent: number };
    const catMap = new Map<string, Map<string, Cell>>();
    // ---- Item monthly avg unit price ----
    type ItemAgg = {
      key: string; name: string; brand: string; category: string; unit: string;
      monthly: Map<string, Cell>;
      firstDate: string; lastDate: string;
      totalSpent: number;
    };
    const itemMap = new Map<string, ItemAgg>();

    for (const it of items) {
      const up = Number(it.unit_price) || 0;
      const price = Number(it.price) || 0;
      if (up <= 0) continue;
      const mk = monthKey(it.bill_date);
      if (!monthSet.has(mk)) continue;
      const cat = it.category || "other";

      let byMonth = catMap.get(cat);
      if (!byMonth) { byMonth = new Map(); catMap.set(cat, byMonth); }
      const cell = byMonth.get(mk) ?? { sumUP: 0, n: 0, spent: 0 };
      cell.sumUP += up;
      cell.n += 1;
      cell.spent += price;
      byMonth.set(mk, cell);

      // item aggregation
      const canon = it.canonical_name && it.canonical_name.trim() ? norm(it.canonical_name) : "";
      const key = canon || `${norm(it.name)}|${norm(it.brand)}`;
      if (!key) continue;
      let agg = itemMap.get(key);
      if (!agg) {
        agg = {
          key, name: it.name, brand: it.brand || "Local",
          category: cat, unit: it.unit || "unit",
          monthly: new Map(),
          firstDate: it.bill_date, lastDate: it.bill_date,
          totalSpent: 0,
        };
        itemMap.set(key, agg);
      }
      const icell = agg.monthly.get(mk) ?? { sumUP: 0, n: 0, spent: 0 };
      icell.sumUP += up;
      icell.n += 1;
      icell.spent += price;
      agg.monthly.set(mk, icell);
      agg.totalSpent += price;
      if (it.bill_date < agg.firstDate) agg.firstDate = it.bill_date;
      if (it.bill_date > agg.lastDate) agg.lastDate = it.bill_date;
    }

    // Build category series
    const categories = [...catMap.entries()].map(([cat, byMonth]) => {
      const series = months.map((m) => {
        const c = byMonth.get(m);
        return {
          month: m,
          label: monthLabel(m),
          avgUnitPrice: c && c.n ? c.sumUP / c.n : null,
          spent: c?.spent ?? 0,
        };
      });
      const withData = series.filter((s) => s.avgUnitPrice !== null) as Array<{ month: string; label: string; avgUnitPrice: number; spent: number }>;
      const first = withData[0]?.avgUnitPrice ?? 0;
      const last = withData[withData.length - 1]?.avgUnitPrice ?? 0;
      const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
      const totalSpent = series.reduce((s, x) => s + x.spent, 0);
      // month-over-month for last two data months
      const momPct = (() => {
        if (withData.length < 2) return 0;
        const a = withData[withData.length - 2].avgUnitPrice;
        const b = withData[withData.length - 1].avgUnitPrice;
        return a > 0 ? ((b - a) / a) * 100 : 0;
      })();
      return {
        category: cat,
        series,
        firstAvg: first,
        lastAvg: last,
        changePct,
        momPct,
        dataPoints: withData.length,
        totalSpent,
      };
    })
      .filter((c) => c.dataPoints >= 2)
      .sort((a, b) => b.totalSpent - a.totalSpent);

    // Overall basket inflation: weighted by spend per category, month by month.
    const overallSeries = months.map((m) => {
      let num = 0, den = 0;
      for (const c of categories) {
        const cell = c.series.find((s) => s.month === m);
        if (!cell || cell.avgUnitPrice === null) continue;
        const w = c.totalSpent || 1;
        num += cell.avgUnitPrice * w;
        den += w;
      }
      return { month: m, label: monthLabel(m), avgUnitPrice: den > 0 ? num / den : null };
    });
    const overallWith = overallSeries.filter((s) => s.avgUnitPrice !== null) as Array<{ month: string; label: string; avgUnitPrice: number }>;
    const overallFirst = overallWith[0]?.avgUnitPrice ?? 0;
    const overallLast = overallWith[overallWith.length - 1]?.avgUnitPrice ?? 0;
    const overallChangePct = overallFirst > 0 ? ((overallLast - overallFirst) / overallFirst) * 100 : 0;
    const overallMoM = (() => {
      if (overallWith.length < 2) return 0;
      const a = overallWith[overallWith.length - 2].avgUnitPrice;
      const b = overallWith[overallWith.length - 1].avgUnitPrice;
      return a > 0 ? ((b - a) / a) * 100 : 0;
    })();

    // Item series (only items with ≥2 months of data)
    const itemSeries = [...itemMap.values()]
      .map((agg) => {
        const series = months.map((m) => {
          const c = agg.monthly.get(m);
          return {
            month: m,
            label: monthLabel(m),
            avgUnitPrice: c && c.n ? c.sumUP / c.n : null,
          };
        });
        const withData = series.filter((s) => s.avgUnitPrice !== null) as Array<{ month: string; label: string; avgUnitPrice: number }>;
        const first = withData[0]?.avgUnitPrice ?? 0;
        const last = withData[withData.length - 1]?.avgUnitPrice ?? 0;
        const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
        const min = withData.length ? Math.min(...withData.map((s) => s.avgUnitPrice)) : 0;
        const max = withData.length ? Math.max(...withData.map((s) => s.avgUnitPrice)) : 0;
        return {
          key: agg.key,
          name: agg.name,
          brand: agg.brand,
          category: agg.category,
          unit: agg.unit,
          series,
          firstAvg: first,
          lastAvg: last,
          minAvg: min,
          maxAvg: max,
          changePct,
          dataPoints: withData.length,
          totalSpent: agg.totalSpent,
        };
      })
      .filter((i) => i.dataPoints >= 2)
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

    const risers = itemSeries.filter((i) => i.changePct > 0).slice(0, 15);
    const fallers = itemSeries.filter((i) => i.changePct < 0).slice(0, 15);

    return {
      currency,
      months,
      monthLabels: months.map(monthLabel),
      overall: {
        series: overallSeries,
        changePct: overallChangePct,
        momPct: overallMoM,
        firstAvg: overallFirst,
        lastAvg: overallLast,
      },
      categories,
      risers,
      fallers,
      totalItems: items.length,
      trackedItems: itemSeries.length,
    };
  });

export type InflationData = Awaited<ReturnType<typeof getInflation>>;