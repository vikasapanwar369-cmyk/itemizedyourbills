import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getBudgetsWithProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [budgetsR, itemsR, billsR] = await Promise.all([
      supabase.from("budgets").select("id, category, monthly_limit, currency").eq("user_id", userId),
      supabase.from("items").select("category, price").eq("user_id", userId).gte("bill_date", monthStart),
      supabase.from("bills").select("currency").eq("user_id", userId).gte("bill_date", monthStart),
    ]);
    if (budgetsR.error) throw new Error(budgetsR.error.message);

    const spendByCat = new Map<string, number>();
    for (const it of itemsR.data ?? []) {
      spendByCat.set(it.category, (spendByCat.get(it.category) ?? 0) + Number(it.price));
    }
    const cc = new Map<string, number>();
    for (const b of billsR.data ?? []) cc.set(b.currency ?? "INR", (cc.get(b.currency ?? "INR") ?? 0) + 1);
    const primaryCurrency = [...cc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "INR";

    // days-through-month for pacing
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const paceFactor = dayOfMonth / daysInMonth;

    const budgets = (budgetsR.data ?? []).map((b) => {
      const spent = spendByCat.get(b.category) ?? 0;
      const limit = Number(b.monthly_limit);
      const pct = limit > 0 ? (spent / limit) * 100 : 0;
      const expectedPct = paceFactor * 100;
      const status: "ok" | "watch" | "over" =
        pct >= 100 ? "over" : pct > expectedPct + 15 ? "watch" : "ok";
      const projected = paceFactor > 0 ? spent / paceFactor : 0;
      return {
        id: b.id,
        category: b.category,
        limit,
        spent,
        remaining: Math.max(0, limit - spent),
        pct: Math.min(999, pct),
        status,
        projected,
        currency: b.currency || primaryCurrency,
      };
    }).sort((a, b) => b.pct - a.pct);

    return { budgets, primaryCurrency };
  });

export const upsertBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { category: string; monthlyLimit: number; currency?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("budgets").upsert(
      { user_id: userId, category: data.category, monthly_limit: data.monthlyLimit, currency: data.currency ?? "INR" },
      { onConflict: "user_id,category" }
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("budgets").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });