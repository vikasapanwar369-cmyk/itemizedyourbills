import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const norm = (s: string) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const DAY = 86_400_000;

export const getShoppingList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("shopping_list_items")
      .select("id, name, brand, qty, unit, category, source, last_price, last_store, checked, created_at")
      .eq("user_id", userId)
      .order("checked", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addShoppingItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    name: string; brand?: string; qty?: number; unit?: string; category?: string;
    source?: string; lastPrice?: number | null; lastStore?: string | null;
  }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("shopping_list_items").insert({
      user_id: userId,
      name: data.name,
      brand: data.brand ?? "",
      qty: data.qty ?? 1,
      unit: data.unit ?? "pcs",
      category: data.category ?? "other",
      source: data.source ?? "manual",
      last_price: data.lastPrice ?? null,
      last_store: data.lastStore ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleShoppingItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; checked: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("shopping_list_items")
      .update({ checked: data.checked })
      .eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteShoppingItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("shopping_list_items")
      .delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearCheckedShopping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("shopping_list_items")
      .delete().eq("user_id", userId).eq("checked", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * After a bill is saved, auto-check any shopping list items that match the
 * purchased items, and flag any unchecked items that were expected at that
 * store but not bought (potential "forgotten" items).
 */
export const reconcileShoppingFromBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    store: string;
    items: Array<{ name: string; canonical_name?: string | null; brand?: string | null }>;
  }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: list, error } = await supabase
      .from("shopping_list_items")
      .select("id, name, brand, last_store")
      .eq("user_id", userId)
      .eq("checked", false);
    if (error) throw new Error(error.message);

    const pending = list ?? [];
    if (pending.length === 0) return { checked: [], forgotten: [] };

    const purchasedKeys = new Set<string>();
    const purchasedNames = new Set<string>();
    for (const it of data.items) {
      const canon = norm(it.canonical_name ?? "");
      const n = norm(it.name);
      const b = norm(it.brand ?? "");
      if (canon) purchasedNames.add(canon);
      if (n) purchasedNames.add(n);
      if (n) purchasedKeys.add(`${n}|${b}`);
    }

    const matchesPurchase = (name: string, brand: string) => {
      const n = norm(name);
      const b = norm(brand);
      if (purchasedKeys.has(`${n}|${b}`)) return true;
      if (purchasedNames.has(n)) return true;
      // token overlap fallback: at least one shared word ≥3 chars
      const tokens = n.split(" ").filter((t) => t.length >= 3);
      for (const p of purchasedNames) {
        for (const t of tokens) if (p.includes(t)) return true;
      }
      return false;
    };

    const toCheck: string[] = [];
    const checkedNames: string[] = [];
    const forgotten: string[] = [];
    const storeNorm = norm(data.store);

    for (const row of pending) {
      if (matchesPurchase(row.name, row.brand ?? "")) {
        toCheck.push(row.id);
        checkedNames.push(row.name);
      } else if (storeNorm && norm(row.last_store ?? "") === storeNorm) {
        forgotten.push(row.name);
      }
    }

    if (toCheck.length > 0) {
      const { error: upErr } = await supabase
        .from("shopping_list_items")
        .update({ checked: true })
        .in("id", toCheck)
        .eq("user_id", userId);
      if (upErr) throw new Error(upErr.message);
    }

    return { checked: checkedNames, forgotten };
  });

/**
 * Scan items history, find refill candidates (Refill Soon / Overdue), and add
 * anything not already on the list.
 */
export const generateFromRefills = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [itemsR, billsR, existingR] = await Promise.all([
      supabase.from("items")
        .select("name, canonical_name, brand, qty, unit, unit_price, price, category, bill_date, bill_id")
        .eq("user_id", userId).order("bill_date", { ascending: true }),
      supabase.from("bills").select("id, store, currency").eq("user_id", userId),
      supabase.from("shopping_list_items").select("name, brand").eq("user_id", userId).eq("checked", false),
    ]);
    if (itemsR.error) throw new Error(itemsR.error.message);

    const billMap = new Map((billsR.data ?? []).map((b) => [b.id, b]));
    const existing = new Set((existingR.data ?? []).map((e) => `${norm(e.name)}|${norm(e.brand)}`));

    type G = { name: string; brand: string; category: string; unit: string; avgQty: number;
      lastPrice: number; lastStore: string; dates: number[]; };
    const groups = new Map<string, G>();
    for (const it of itemsR.data ?? []) {
      const canon = it.canonical_name && it.canonical_name.trim() ? norm(it.canonical_name) : "";
      const key = canon || `${norm(it.name)}|${norm(it.brand)}`;
      if (!key) continue;
      const bill = billMap.get(it.bill_id);
      const g = groups.get(key) ?? {
        name: it.name, brand: it.brand, category: it.category, unit: it.unit,
        avgQty: 0, lastPrice: 0, lastStore: bill?.store ?? "Unknown", dates: [],
      };
      g.avgQty += Number(it.qty) || 1;
      g.lastPrice = Number(it.unit_price) || Number(it.price) || 0;
      g.lastStore = bill?.store ?? g.lastStore;
      g.dates.push(+new Date(it.bill_date));
      groups.set(key, g);
    }

    const toAdd: Array<Omit<G, "dates"> & { source: string }> = [];
    for (const [key, g] of groups) {
      if (g.dates.length < 2) continue;
      const gaps: number[] = [];
      const sorted = g.dates.sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) gaps.push((sorted[i] - sorted[i - 1]) / DAY);
      const avgGap = gaps.reduce((s, x) => s + x, 0) / gaps.length;
      if (avgGap <= 0) continue;
      const daysSince = (Date.now() - sorted[sorted.length - 1]) / DAY;
      const daysUntil = avgGap - daysSince;
      const source = daysUntil < 0 ? "overdue" : daysUntil <= 3 ? "auto_refill" : null;
      if (!source) continue;
      const nameKey = `${norm(g.name)}|${norm(g.brand)}`;
      if (existing.has(nameKey)) continue;
      toAdd.push({
        name: g.name, brand: g.brand, category: g.category, unit: g.unit,
        avgQty: Math.max(1, Math.round(g.avgQty / g.dates.length)),
        lastPrice: g.lastPrice, lastStore: g.lastStore, source,
      });
      void key;
    }

    if (toAdd.length > 0) {
      const rows = toAdd.map((t) => ({
        user_id: userId,
        name: t.name, brand: t.brand, category: t.category, unit: t.unit,
        qty: t.avgQty, source: t.source, last_price: t.lastPrice, last_store: t.lastStore,
      }));
      const { error } = await supabase.from("shopping_list_items").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { added: toAdd.length };
  });