import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { visibleUserIds } from "@/lib/household.server";

const DAY = 86_400_000;

export type AlertSeverity = "high" | "medium" | "low";
export type AlertKind = "budget" | "recurring" | "refill" | "price";

export type Alert = {
  key: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  body: string;
  amount: number | null;
  currency: string;
  to: string | null;
  when: string | null;
};

export type NotificationSettings = {
  budget_alerts: boolean;
  recurring_alerts: boolean;
  refill_alerts: boolean;
  price_alerts: boolean;
  email_enabled: boolean;
};

const DEFAULTS: NotificationSettings = {
  budget_alerts: true,
  recurring_alerts: true,
  refill_alerts: true,
  price_alerts: true,
  email_enabled: false,
};

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export const getAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const ids = await visibleUserIds(supabase, userId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [settingsR, dismissedR, budgetsR, monthItemsR, allItemsR, recurringR, billsR] = await Promise.all([
      supabase.from("notification_settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("dismissed_alerts").select("alert_key").eq("user_id", userId),
      supabase.from("budgets").select("id, category, monthly_limit, currency").in("user_id", ids),
      supabase.from("items").select("category, price").in("user_id", ids).gte("bill_date", monthStart),
      supabase
        .from("items")
        .select("name, canonical_name, brand, qty, unit, unit_price, bill_date")
        .in("user_id", ids)
        .order("bill_date", { ascending: true }),
      supabase.from("recurring_bills").select("*").in("user_id", ids).neq("status", "disabled"),
      supabase.from("bills").select("currency").in("user_id", ids).gte("bill_date", monthStart),
    ]);

    const settings: NotificationSettings = { ...DEFAULTS, ...(settingsR.data ?? {}) };
    const dismissed = new Set((dismissedR.data ?? []).map((d) => d.alert_key));

    const cc = new Map<string, number>();
    for (const b of billsR.data ?? []) cc.set(b.currency ?? "INR", (cc.get(b.currency ?? "INR") ?? 0) + 1);
    const currency = [...cc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "INR";

    const alerts: Alert[] = [];

    // ---- Budget alerts ----
    if (settings.budget_alerts) {
      const spend = new Map<string, number>();
      for (const it of monthItemsR.data ?? []) {
        spend.set(it.category, (spend.get(it.category) ?? 0) + Number(it.price));
      }
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const pace = now.getDate() / daysInMonth;
      for (const b of budgetsR.data ?? []) {
        const limit = Number(b.monthly_limit) || 0;
        const spent = spend.get(b.category) ?? 0;
        if (limit <= 0) continue;
        const pct = (spent / limit) * 100;
        const projected = pace > 0 ? spent / pace : spent;
        if (pct >= 100) {
          alerts.push({
            key: `budget-over-${b.category}-${now.getFullYear()}-${now.getMonth()}`,
            kind: "budget", severity: "high",
            title: `${b.category} budget exceeded`,
            body: `You've spent ${Math.round(pct)}% of your monthly limit.`,
            amount: spent - limit, currency: b.currency || currency,
            to: "/budgets", when: null,
          });
        } else if (pct >= 80) {
          alerts.push({
            key: `budget-near-${b.category}-${now.getFullYear()}-${now.getMonth()}`,
            kind: "budget", severity: "medium",
            title: `${b.category} budget at ${Math.round(pct)}%`,
            body: `Only ${Math.round(100 - pct)}% of this month's limit left.`,
            amount: Math.max(0, limit - spent), currency: b.currency || currency,
            to: "/budgets", when: null,
          });
        } else if (projected > limit * 1.15) {
          alerts.push({
            key: `budget-pace-${b.category}-${now.getFullYear()}-${now.getMonth()}`,
            kind: "budget", severity: "low",
            title: `${b.category} spending is running hot`,
            body: `At this pace you'll finish the month over your limit.`,
            amount: projected, currency: b.currency || currency,
            to: "/budgets", when: null,
          });
        }
      }
    }

    // ---- Recurring bill reminders ----
    if (settings.recurring_alerts) {
      for (const r of recurringR.data ?? []) {
        if (!r.next_due_date) continue;
        const days = Math.round((+new Date(r.next_due_date) - +now) / DAY);
        if (days > 7) continue;
        alerts.push({
          key: `recurring-${r.id}-${r.next_due_date}`,
          kind: "recurring",
          severity: days < 0 ? "high" : days <= 2 ? "medium" : "low",
          title: days < 0 ? `${r.store} bill is overdue` : `${r.store} bill due ${days === 0 ? "today" : `in ${days}d`}`,
          body: `Repeats about every ${r.cadence_days} days · ${r.category}`,
          amount: Number(r.avg_amount) || null,
          currency: r.currency || currency,
          to: "/recurring",
          when: r.next_due_date,
        });
      }
    }

    // ---- Refill + price alerts (item cadence) ----
    if (settings.refill_alerts || settings.price_alerts) {
      type Occ = { date: string; unitPrice: number; qty: number };
      const groups = new Map<string, { name: string; brand: string; unit: string; occ: Occ[] }>();
      for (const it of allItemsR.data ?? []) {
        const key = norm(it.canonical_name) || `${norm(it.name)}|${norm(it.brand)}`;
        if (!key) continue;
        const g = groups.get(key) ?? { name: it.name, brand: it.brand ?? "", unit: it.unit ?? "", occ: [] };
        g.occ.push({ date: it.bill_date, unitPrice: Number(it.unit_price) || 0, qty: Number(it.qty) || 1 });
        groups.set(key, g);
      }
      for (const [key, g] of groups) {
        if (g.occ.length < 2) continue;
        const dates = g.occ.map((o) => +new Date(o.date)).sort((a, b) => a - b);
        const gaps: number[] = [];
        for (let i = 1; i < dates.length; i++) {
          const gap = (dates[i] - dates[i - 1]) / DAY;
          if (gap >= 1) gaps.push(gap);
        }
        if (!gaps.length) continue;
        const avgGap = gaps.reduce((s, g2) => s + g2, 0) / gaps.length;
        const last = dates[dates.length - 1];
        const dueIn = Math.round((last + avgGap * DAY - +now) / DAY);

        if (settings.refill_alerts && dueIn <= 3) {
          alerts.push({
            key: `refill-${key}`,
            kind: "refill",
            severity: dueIn < 0 ? "high" : "medium",
            title: dueIn < 0 ? `${g.name} is overdue for a refill` : `${g.name} runs out ${dueIn === 0 ? "today" : `in ${dueIn}d`}`,
            body: `You buy this every ~${Math.round(avgGap)} days${g.brand ? ` · ${g.brand}` : ""}`,
            amount: null, currency,
            to: "/shopping", when: null,
          });
        }

        if (settings.price_alerts) {
          const prices = g.occ.filter((o) => o.unitPrice > 0).sort((a, b) => +new Date(a.date) - +new Date(b.date));
          if (prices.length >= 2) {
            const first = prices[0].unitPrice;
            const latest = prices[prices.length - 1].unitPrice;
            const delta = ((latest - first) / first) * 100;
            if (Math.abs(delta) >= 20) {
              alerts.push({
                key: `price-${key}-${Math.round(latest)}`,
                kind: "price",
                severity: delta > 0 ? "medium" : "low",
                title: `${g.name} is ${delta > 0 ? "up" : "down"} ${Math.abs(Math.round(delta))}%`,
                body: `Unit price moved from ${first.toFixed(0)} to ${latest.toFixed(0)}${g.unit ? ` per ${g.unit}` : ""}.`,
                amount: latest, currency,
                to: "/inflation", when: null,
              });
            }
          }
        }
      }
    }

    const rank: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 };
    const visible = alerts
      .filter((a) => !dismissed.has(a.key))
      .sort((a, b) => rank[a.severity] - rank[b.severity]);

    return {
      alerts: visible.slice(0, 60),
      counts: {
        total: visible.length,
        high: visible.filter((a) => a.severity === "high").length,
      },
      settings,
      currency,
    };
  });

export const getNotificationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("notification_settings").select("*").eq("user_id", userId).maybeSingle();
    return { ...DEFAULTS, ...(data ?? {}) } as NotificationSettings;
  });

export const updateNotificationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Partial<NotificationSettings>) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, boolean> = {};
    for (const k of Object.keys(DEFAULTS) as (keyof NotificationSettings)[]) {
      if (typeof data[k] === "boolean") patch[k] = data[k] as boolean;
    }
    const { error } = await supabase
      .from("notification_settings")
      .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const dismissAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { key: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = (data.key ?? "").slice(0, 200);
    if (!key) throw new Error("Missing alert key");
    const { error } = await supabase
      .from("dismissed_alerts")
      .upsert({ user_id: userId, alert_key: key }, { onConflict: "user_id,alert_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearDismissedAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("dismissed_alerts").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
