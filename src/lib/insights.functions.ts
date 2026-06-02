import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ItemRow = {
  name: string;
  canonical_name: string | null;
  brand: string;
  qty: number;
  unit: string;
  unit_price: number;
  price: number;
  sub: string;
  category: string;
  bill_date: string;
  bill_id: string;
};

type Occurrence = {
  date: string;
  qty: number;
  unitPrice: number;
  price: number;
  store: string;
  currency: string;
};

const DAY = 86_400_000;
const norm = (s: string) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function buildInsight(g: {
  key: string;
  display: string;
  brand: string;
  category: string;
  sub: string;
  unit: string;
  occurrences: Occurrence[];
}) {
  const occ = g.occurrences.slice().sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const dates = occ.map((o) => +new Date(o.date));
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const d = (dates[i] - dates[i - 1]) / DAY;
    if (d > 0) gaps.push(d);
  }
  const avgGap = gaps.length ? gaps.reduce((s, x) => s + x, 0) / gaps.length : 0;
  const last = dates[dates.length - 1];
  const nextDue = avgGap > 0 ? last + avgGap * DAY : 0;
  const daysUntil = nextDue ? Math.round((nextDue - Date.now()) / DAY) : null;

  const totalQty = occ.reduce((s, o) => s + o.qty, 0);
  const totalSpent = occ.reduce((s, o) => s + o.price, 0);
  const firstUP = occ[0].unitPrice;
  const lastUP = occ[occ.length - 1].unitPrice;
  const priceDelta = firstUP > 0 ? ((lastUP - firstUP) / firstUP) * 100 : 0;

  const storeMap = new Map<string, { sum: number; n: number; currency: string }>();
  for (const o of occ) {
    const cur = storeMap.get(o.store) ?? { sum: 0, n: 0, currency: o.currency };
    cur.sum += o.unitPrice;
    cur.n += 1;
    cur.currency = o.currency;
    storeMap.set(o.store, cur);
  }
  const stores = [...storeMap.entries()]
    .map(([store, v]) => ({ store, avgUnitPrice: v.n ? v.sum / v.n : 0, currency: v.currency }))
    .filter((s) => s.avgUnitPrice > 0)
    .sort((a, b) => a.avgUnitPrice - b.avgUnitPrice);

  const cm = new Map<string, number>();
  for (const o of occ) cm.set(o.currency, (cm.get(o.currency) ?? 0) + 1);
  const currency = [...cm.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "INR";

  return {
    key: g.key,
    name: g.display,
    brand: g.brand,
    category: g.category,
    sub: g.sub,
    unit: g.unit,
    count: occ.length,
    avgGapDays: Math.round(avgGap),
    lastDate: new Date(last).toISOString(),
    nextDueDate: nextDue ? new Date(nextDue).toISOString() : null,
    daysUntilDue: daysUntil,
    totalQty,
    totalSpent,
    firstUnitPrice: firstUP,
    lastUnitPrice: lastUP,
    priceDeltaPct: priceDelta,
    stores,
    cheapestStore: stores[0]?.store ?? null,
    cheapestUnitPrice: stores[0]?.avgUnitPrice ?? 0,
    avgQty: Math.max(1, Math.round(totalQty / occ.length)),
    currency,
  };
}

export type RepeatInsight = ReturnType<typeof buildInsight>;

export const getInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const [itemsR, billsR] = await Promise.all([
      supabase
        .from("items")
        .select("name, canonical_name, brand, qty, unit, unit_price, price, sub, category, bill_date, bill_id")
        .eq("user_id", userId)
        .order("bill_date", { ascending: true }),
      supabase.from("bills").select("id, store, currency").eq("user_id", userId),
    ]);
    if (itemsR.error) throw new Error(itemsR.error.message);
    if (billsR.error) throw new Error(billsR.error.message);

    const items = (itemsR.data ?? []) as ItemRow[];
    const billMap = new Map((billsR.data ?? []).map((b) => [b.id, b]));

    const groups = new Map<string, {
      key: string; display: string; brand: string; category: string; sub: string; unit: string; occurrences: Occurrence[];
    }>();

    for (const it of items) {
      const canon = it.canonical_name && it.canonical_name.trim() ? norm(it.canonical_name) : "";
      const key = canon || `${norm(it.name)}|${norm(it.brand)}`;
      if (!key) continue;
      const bill = billMap.get(it.bill_id);
      const g = groups.get(key) ?? {
        key, display: it.name, brand: it.brand,
        category: it.category, sub: it.sub, unit: it.unit,
        occurrences: [],
      };
      g.occurrences.push({
        date: it.bill_date,
        qty: Number(it.qty) || 1,
        unitPrice: Number(it.unit_price) || 0,
        price: Number(it.price) || 0,
        store: bill?.store ?? "Unknown",
        currency: bill?.currency ?? "INR",
      });
      groups.set(key, g);
    }

    const insights = [...groups.values()]
      .filter((g) => g.occurrences.length >= 2)
      .map(buildInsight);

    const repeats = insights
      .slice()
      .sort((a, b) => b.count - a.count || b.totalSpent - a.totalSpent)
      .slice(0, 40);

    const lowStock = insights
      .filter((i) => i.daysUntilDue !== null && i.daysUntilDue <= 3)
      .sort((a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0));

    const priceAlerts = insights
      .filter((i) => Math.abs(i.priceDeltaPct) >= 15 && i.firstUnitPrice > 0)
      .sort((a, b) => Math.abs(b.priceDeltaPct) - Math.abs(a.priceDeltaPct))
      .slice(0, 20);

    const shoppingList = lowStock.map((i) => ({
      key: i.key, name: i.name, brand: i.brand,
      qty: i.avgQty, unit: i.unit,
      cheapestStore: i.cheapestStore,
      currency: i.currency,
      lastUnitPrice: i.lastUnitPrice,
      estimatedCost: (i.avgQty || 1) * (i.cheapestUnitPrice || i.lastUnitPrice || 0),
    }));

    const storeCompare = insights
      .filter((i) => i.stores.length >= 2 && i.stores[i.stores.length - 1].avgUnitPrice > i.stores[0].avgUnitPrice * 1.05)
      .sort((a, b) => {
        const aSpread = a.stores[a.stores.length - 1].avgUnitPrice - a.stores[0].avgUnitPrice;
        const bSpread = b.stores[b.stores.length - 1].avgUnitPrice - b.stores[0].avgUnitPrice;
        return bSpread - aSpread;
      })
      .slice(0, 20);

    return {
      repeats,
      lowStock,
      priceAlerts,
      shoppingList,
      storeCompare,
      totalItemsTracked: insights.length,
      totalItems: items.length,
    };
  });