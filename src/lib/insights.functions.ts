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

export const getItemDetail = createServerFn({ method: "GET" })
  .inputValidator((data: { key: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const [itemsR, billsR] = await Promise.all([
      supabase
        .from("items")
        .select("id, name, canonical_name, brand, company, qty, unit, unit_weight_or_volume, unit_price, price, mrp, gst_percent, sub, category, bill_date, bill_id")
        .eq("user_id", userId)
        .order("bill_date", { ascending: false }),
      supabase.from("bills").select("id, store, currency, image_url, payment_mode").eq("user_id", userId),
    ]);
    if (itemsR.error) throw new Error(itemsR.error.message);
    if (billsR.error) throw new Error(billsR.error.message);

    const items = (itemsR.data ?? []);
    const billMap = new Map((billsR.data ?? []).map((b) => [b.id, b]));
    const targetKey = data.key;

    const matching = items.filter((it) => {
      const canon = it.canonical_name && it.canonical_name.trim() ? norm(it.canonical_name) : "";
      const k = canon || `${norm(it.name)}|${norm(it.brand)}`;
      return k === targetKey;
    });

    if (matching.length === 0) return null;

    const occurrences = matching.map((it) => {
      const bill = billMap.get(it.bill_id);
      return {
        itemId: it.id,
        billId: it.bill_id,
        date: it.bill_date,
        name: it.name,
        brand: it.brand,
        company: it.company,
        qty: Number(it.qty) || 1,
        unit: it.unit,
        unitWeightOrVolume: it.unit_weight_or_volume,
        unitPrice: Number(it.unit_price) || 0,
        price: Number(it.price) || 0,
        mrp: it.mrp != null ? Number(it.mrp) : null,
        gstPercent: it.gst_percent != null ? Number(it.gst_percent) : null,
        sub: it.sub,
        category: it.category,
        store: bill?.store ?? "Unknown",
        currency: bill?.currency ?? "INR",
        imageUrl: bill?.image_url ?? null,
        paymentMode: bill?.payment_mode ?? null,
      };
    });

    const sortedAsc = occurrences.slice().sort((a, b) => +new Date(a.date) - +new Date(b.date));
    const gaps: number[] = [];
    const dates = sortedAsc.map((o) => +new Date(o.date));
    for (let i = 1; i < dates.length; i++) {
      const d = (dates[i] - dates[i - 1]) / DAY;
      if (d > 0) gaps.push(d);
    }
    const avgGap = gaps.length ? gaps.reduce((s, x) => s + x, 0) / gaps.length : 0;
    const last = dates[dates.length - 1];
    const nextDue = avgGap > 0 ? last + avgGap * DAY : 0;

    const totalQty = occurrences.reduce((s, o) => s + o.qty, 0);
    const totalSpent = occurrences.reduce((s, o) => s + o.price, 0);
    const firstUP = sortedAsc[0].unitPrice;
    const lastUP = sortedAsc[sortedAsc.length - 1].unitPrice;
    const priceDelta = firstUP > 0 ? ((lastUP - firstUP) / firstUP) * 100 : 0;
    const minUP = Math.min(...occurrences.map((o) => o.unitPrice).filter((p) => p > 0));
    const maxUP = Math.max(...occurrences.map((o) => o.unitPrice));
    const avgUP = occurrences.length ? occurrences.reduce((s, o) => s + o.unitPrice, 0) / occurrences.length : 0;

    const storeMap = new Map<string, { sum: number; n: number; spent: number; currency: string }>();
    for (const o of occurrences) {
      const cur = storeMap.get(o.store) ?? { sum: 0, n: 0, spent: 0, currency: o.currency };
      cur.sum += o.unitPrice;
      cur.n += 1;
      cur.spent += o.price;
      cur.currency = o.currency;
      storeMap.set(o.store, cur);
    }
    const stores = [...storeMap.entries()]
      .map(([store, v]) => ({ store, avgUnitPrice: v.n ? v.sum / v.n : 0, times: v.n, totalSpent: v.spent, currency: v.currency }))
      .sort((a, b) => a.avgUnitPrice - b.avgUnitPrice);

    const cm = new Map<string, number>();
    for (const o of occurrences) cm.set(o.currency, (cm.get(o.currency) ?? 0) + 1);
    const currency = [...cm.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "INR";

    const head = occurrences[0];
    return {
      key: targetKey,
      name: head.name,
      brand: head.brand,
      company: head.company,
      sub: head.sub,
      category: head.category,
      unit: head.unit,
      unitWeightOrVolume: head.unitWeightOrVolume,
      currency,
      count: occurrences.length,
      totalQty,
      totalSpent,
      avgGapDays: Math.round(avgGap),
      lastDate: new Date(last).toISOString(),
      firstDate: new Date(dates[0]).toISOString(),
      nextDueDate: nextDue ? new Date(nextDue).toISOString() : null,
      daysUntilDue: nextDue ? Math.round((nextDue - Date.now()) / DAY) : null,
      firstUnitPrice: firstUP,
      lastUnitPrice: lastUP,
      minUnitPrice: isFinite(minUP) ? minUP : 0,
      maxUnitPrice: maxUP,
      avgUnitPrice: avgUP,
      priceDeltaPct: priceDelta,
      stores,
      cheapestStore: stores[0]?.store ?? null,
      occurrences: occurrences.sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    };
  });

export type ItemDetail = NonNullable<Awaited<ReturnType<typeof getItemDetail>>>;

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

    // ---- Brand-switching savings ----
    // Premium brands → typical generic equivalents. Savings estimated at 22% of monthly spend.
    const PREMIUM: Record<string, { generic: string; savePct: number }> = {
      amul:          { generic: "store-brand dairy",    savePct: 0.18 },
      "mother dairy":{ generic: "local dairy",          savePct: 0.15 },
      nestle:        { generic: "store-brand",          savePct: 0.20 },
      dettol:        { generic: "Savlon / store soap",  savePct: 0.25 },
      lifebuoy:      { generic: "store-brand soap",     savePct: 0.20 },
      dove:          { generic: "store-brand soap",     savePct: 0.30 },
      "surf excel":  { generic: "Wheel / Tide basic",   savePct: 0.28 },
      ariel:         { generic: "Wheel / store brand",  savePct: 0.25 },
      tide:          { generic: "Wheel / store brand",  savePct: 0.22 },
      colgate:       { generic: "store-brand paste",    savePct: 0.30 },
      sensodyne:     { generic: "Colgate / store",      savePct: 0.25 },
      kelloggs:      { generic: "store-brand cereal",   savePct: 0.30 },
      maggi:         { generic: "store-brand noodles",  savePct: 0.20 },
      bisleri:       { generic: "store-brand water",    savePct: 0.30 },
      himalaya:      { generic: "store-brand",          savePct: 0.20 },
      pampers:       { generic: "Mamy Poko / store",    savePct: 0.25 },
      huggies:       { generic: "Mamy Poko / store",    savePct: 0.22 },
    };
    const monthMs = 30 * DAY;
    const since = Date.now() - monthMs;
    const brandSwap = insights
      .map((i) => {
        const swap = PREMIUM[i.brand?.toLowerCase?.() ?? ""];
        if (!swap) return null;
        const recent = i.totalSpent && i.count
          ? (i.totalSpent / i.count) * Math.max(1, Math.round(monthMs / (i.avgGapDays * DAY || monthMs)))
          : 0;
        const monthlySpend = recent || (i.lastUnitPrice * i.avgQty);
        const monthlySaving = monthlySpend * swap.savePct;
        if (monthlySaving < 5) return null;
        return {
          key: i.key,
          name: i.name,
          brand: i.brand,
          alternative: swap.generic,
          savePct: Math.round(swap.savePct * 100),
          monthlySpend,
          monthlySaving,
          yearlySaving: monthlySaving * 12,
          currency: i.currency,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.monthlySaving - a.monthlySaving)
      .slice(0, 10);

    // ---- Bulk-buy advisory ----
    // Items bought very frequently in small quantities → buying ~4× pack saves trips & ~10%.
    const bulkBuy = insights
      .filter((i) => i.avgGapDays > 0 && i.avgGapDays <= 4 && i.count >= 3 && i.avgQty <= 2)
      .map((i) => {
        const tripsPerMonth = Math.max(1, Math.round(30 / i.avgGapDays));
        const suggestedPack = Math.max(2, Math.round(tripsPerMonth / 2));
        const monthlySpend = i.lastUnitPrice * i.avgQty * tripsPerMonth;
        const estSaving = monthlySpend * 0.10;
        const tripsSaved = tripsPerMonth - Math.ceil(tripsPerMonth / suggestedPack);
        return {
          key: i.key,
          name: i.name,
          brand: i.brand,
          unit: i.unit,
          currentQty: i.avgQty,
          currentEveryDays: i.avgGapDays,
          suggestedPack,
          tripsPerMonth,
          tripsSaved,
          monthlySaving: estSaving,
          yearlySaving: estSaving * 12,
          currency: i.currency,
        };
      })
      .sort((a, b) => b.monthlySaving - a.monthlySaving)
      .slice(0, 10);
    void since; // reserved for future windowing

    return {
      repeats,
      lowStock,
      priceAlerts,
      shoppingList,
      storeCompare,
      brandSwap,
      bulkBuy,
      totalItemsTracked: insights.length,
      totalItems: items.length,
    };
  });