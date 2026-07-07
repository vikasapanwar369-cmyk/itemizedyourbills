import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DAY = 86_400_000;
const keyOf = (store: string, category: string) =>
  `${(store ?? "").trim().toLowerCase()}|${(category ?? "other").toLowerCase()}`;

export type RecurringRow = {
  id: string | null;
  key: string;
  store: string;
  category: string;
  cadenceDays: number;
  avgAmount: number;
  currency: string;
  status: "pending" | "confirmed" | "disabled";
  nextDueDate: string | null;
  daysUntilDue: number | null;
  lastSeenDate: string | null;
  count: number;
  confidence: "high" | "medium" | "low";
  detected: boolean;
  note: string | null;
};

export const getRecurringBills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const [billsR, savedR] = await Promise.all([
      supabase
        .from("bills")
        .select("id, store, category, total, bill_date, currency")
        .eq("user_id", userId)
        .order("bill_date", { ascending: true }),
      supabase.from("recurring_bills").select("*").eq("user_id", userId),
    ]);
    if (billsR.error) throw new Error(billsR.error.message);
    if (savedR.error) throw new Error(savedR.error.message);

    const bills = billsR.data ?? [];
    const saved = savedR.data ?? [];
    const savedByKey = new Map(saved.map((s) => [s.key, s]));

    // Detect from history
    const byKey = new Map<string, typeof bills>();
    for (const b of bills) {
      const k = keyOf(b.store ?? "", b.category ?? "other");
      const arr = byKey.get(k) ?? [];
      arr.push(b);
      byKey.set(k, arr);
    }

    const rows: RecurringRow[] = [];
    for (const [k, arr] of byKey.entries()) {
      const sorted = arr.slice().sort((a, b) => +new Date(a.bill_date) - +new Date(b.bill_date));
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        gaps.push((+new Date(sorted[i].bill_date) - +new Date(sorted[i - 1].bill_date)) / DAY);
      }
      const avgGap = gaps.length ? gaps.reduce((s, x) => s + x, 0) / gaps.length : 0;
      const totals = sorted.map((b) => Number(b.total));
      const avgAmount = totals.reduce((s, x) => s + x, 0) / (totals.length || 1);
      const variance = totals.reduce((s, x) => s + Math.pow(x - avgAmount, 2), 0) / (totals.length || 1);
      const cv = avgAmount > 0 ? Math.sqrt(variance) / avgAmount : 1;

      const monthly = avgGap >= 25 && avgGap <= 35;
      const weekly = avgGap >= 5 && avgGap <= 9;
      const biMonthly = avgGap >= 55 && avgGap <= 70;
      const cadenceOk = monthly || weekly || biMonthly;
      const detected = arr.length >= 2 && cadenceOk && cv <= 0.35;

      const stored = savedByKey.get(k);
      if (!detected && !stored) continue;

      const last = sorted[sorted.length - 1];
      const cadenceDays = stored?.cadence_days ?? (Math.round(avgGap) || 30);
      const nextTs = last ? +new Date(last.bill_date) + cadenceDays * DAY : null;
      const nextDueDate = stored?.next_due_date ?? (nextTs ? new Date(nextTs).toISOString() : null);
      const daysUntilDue = nextDueDate ? Math.round((+new Date(nextDueDate) - Date.now()) / DAY) : null;
      const confidence: "high" | "medium" | "low" =
        arr.length >= 3 && cv < 0.2 ? "high" : arr.length >= 2 && cv < 0.35 ? "medium" : "low";

      rows.push({
        id: stored?.id ?? null,
        key: k,
        store: stored?.store ?? last?.store ?? "Unknown",
        category: stored?.category ?? last?.category ?? "other",
        cadenceDays,
        avgAmount: stored?.avg_amount != null ? Number(stored.avg_amount) : avgAmount,
        currency: stored?.currency ?? last?.currency ?? "INR",
        status: (stored?.status as RecurringRow["status"]) ?? "pending",
        nextDueDate,
        daysUntilDue,
        lastSeenDate: last?.bill_date ?? stored?.last_seen_date ?? null,
        count: arr.length,
        confidence,
        detected,
        note: stored?.note ?? null,
      });
    }

    rows.sort((a, b) => {
      const rank = (s: RecurringRow["status"]) => (s === "confirmed" ? 0 : s === "pending" ? 1 : 2);
      const rd = rank(a.status) - rank(b.status);
      if (rd !== 0) return rd;
      return (a.daysUntilDue ?? 9999) - (b.daysUntilDue ?? 9999);
    });

    return rows;
  });

export const upsertRecurringBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        key: z.string().min(1),
        store: z.string().min(1),
        category: z.string().min(1),
        cadenceDays: z.coerce.number().int().min(1).max(400),
        avgAmount: z.coerce.number().min(0),
        currency: z.string().default("INR"),
        status: z.enum(["pending", "confirmed", "disabled"]),
        lastSeenDate: z.string().nullable().optional(),
        note: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { userId, supabase } = context;
    const nextTs = data.lastSeenDate ? +new Date(data.lastSeenDate) + data.cadenceDays * DAY : null;
    const nextDue = nextTs ? new Date(nextTs).toISOString() : null;
    const { error } = await supabase.from("recurring_bills").upsert(
      {
        user_id: userId,
        key: data.key,
        store: data.store,
        category: data.category,
        cadence_days: data.cadenceDays,
        avg_amount: data.avgAmount,
        currency: data.currency,
        status: data.status,
        next_due_date: nextDue,
        last_seen_date: data.lastSeenDate ?? null,
        note: data.note ?? null,
      },
      { onConflict: "user_id,key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRecurringBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ key: z.string().min(1) }).parse(input))
  .handler(async ({ context, data }) => {
    const { userId, supabase } = context;
    const { error } = await supabase.from("recurring_bills").delete().eq("user_id", userId).eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
