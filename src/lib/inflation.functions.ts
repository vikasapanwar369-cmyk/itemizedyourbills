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
  .inputValidator(
    (input?: { category?: string; sub?: string; brand?: string; from?: string; to?: string } | null) => {
      const isDate = (s?: string) => !!s && !Number.isNaN(new Date(s).getTime());
      return {
        category: input?.category && input.category !== "all" ? input.category : "",
        sub: input?.sub && input.sub !== "all" ? input.sub : "",
        brand: input?.brand && input.brand !== "all" ? input.brand : "",
        from: isDate(input?.from) ? input!.from!.slice(0, 10) : "",
        to: isDate(input?.to) ? input!.to!.slice(0, 10) : "",
      };
    },
  )
  .handler(async ({ context, data: filters }) => {
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

    const allItems = (itemsR.data ?? []) as ItemRow[];
    const billCurrency = new Map((billsR.data ?? []).map((b) => [b.id, b.currency ?? "INR"]));

    const cm = new Map<string, number>();
    for (const [, c] of billCurrency) cm.set(c, (cm.get(c) ?? 0) + 1);
    const currency = [...cm.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "INR";

    // ---- Period: custom range if provided, else last 12 months ----
    const now = new Date();
    let start: Date;
    let end: Date;
    if (filters.from || filters.to) {
      start = filters.from ? new Date(`${filters.from}T00:00:00`) : new Date(now.getFullYear(), now.getMonth() - 11, 1);
      end = filters.to ? new Date(`${filters.to}T23:59:59.999`) : now;
      if (start > end) [start, end] = [end, start];
    } else {
      start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      end = now;
    }
    const startMs = start.getTime();
    const endMs = end.getTime();

    const months: string[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    // hard cap to keep charts readable
    while (cursor <= lastMonth && months.length < 60) {
      months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const monthSet = new Set(months);

    // ---- Facets (built from all items, so options never disappear) ----
    const catSet = new Set<string>();
    const subsByCat = new Map<string, Set<string>>();
    const brandsByKey = new Map<string, Set<string>>();
    for (const it of allItems) {
      const cat = it.category || "other";
      const sub = (it.sub || "").trim();
      const brand = (it.brand || "").trim();
      catSet.add(cat);
      if (sub) {
        if (!subsByCat.has(cat)) subsByCat.set(cat, new Set());
        subsByCat.get(cat)!.add(sub);
      }
      if (brand) {
        for (const k of [`c:${cat}`, `s:${cat}|${sub}`, "*"]) {
          if (!brandsByKey.has(k)) brandsByKey.set(k, new Set());
          brandsByKey.get(k)!.add(brand);
        }
      }
    }
    const facets = {
      categories: [...catSet].sort(),
      subcategories: [...subsByCat.entries()].map(([category, s]) => ({ category, subs: [...s].sort() })),
      brands: [...brandsByKey.entries()].map(([key, s]) => ({ key, brands: [...s].sort() })),
    };

    const items = allItems.filter((it) => {
      const t = new Date(it.bill_date).getTime();
      if (Number.isNaN(t) || t < startMs || t > endMs) return false;
      if (filters.category && (it.category || "other") !== filters.category) return false;
      if (filters.sub && (it.sub || "").trim() !== filters.sub) return false;
      if (filters.brand && (it.brand || "").trim() !== filters.brand) return false;
      return true;
    });

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
      facets,
      applied: filters,
    };
  });

export type InflationData = Awaited<ReturnType<typeof getInflation>>;