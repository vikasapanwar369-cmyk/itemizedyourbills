import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { getCategory } from "@/lib/categories";
import { CategoryIcon } from "@/components/CategoryIcon";
import { money, fullDate, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Monthly Report — BillSnap" }] }),
  component: ReportsPage,
});

function monthRange(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  return { start, end };
}

function ReportsPage() {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const { start, end } = monthRange(cursor.y, cursor.m);
  const prev = monthRange(cursor.y, cursor.m - 1);

  const { data } = useQuery({
    queryKey: ["monthly-report", cursor.y, cursor.m],
    queryFn: async () => {
      const [{ data: items }, { data: bills }, { data: prevItems }] = await Promise.all([
        supabase.from("items").select("category, price, bill_date, bill_id").gte("bill_date", start.toISOString()).lt("bill_date", end.toISOString()),
        supabase.from("bills").select("id, store, bill_date, category, total, currency").gte("bill_date", start.toISOString()).lt("bill_date", end.toISOString()).order("bill_date", { ascending: false }),
        supabase.from("items").select("category, price").gte("bill_date", prev.start.toISOString()).lt("bill_date", prev.end.toISOString()),
      ]);
      return { items: items ?? [], bills: bills ?? [], prevItems: prevItems ?? [] };
    },
  });

  const items = data?.items ?? [];
  const bills = data?.bills ?? [];
  const prevItems = data?.prevItems ?? [];

  const currency = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of bills) counts.set(b.currency ?? "INR", (counts.get(b.currency ?? "INR") ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "INR";
  }, [bills]);
  const fmt = (v: number) => money(v, currency);

  const total = items.reduce((s, it) => s + Number(it.price), 0);
  const prevTotal = prevItems.reduce((s, it) => s + Number(it.price), 0);

  // Category breakdown (current)
  const byCat = new Map<string, number>();
  for (const it of items) byCat.set(it.category, (byCat.get(it.category) ?? 0) + Number(it.price));
  const catData = Array.from(byCat.entries())
    .map(([cat, val]) => ({ cat, val, meta: getCategory(cat), pct: total > 0 ? (val / total) * 100 : 0 }))
    .sort((a, b) => b.val - a.val);

  // Category breakdown (prev) for comparison
  const byCatPrev = new Map<string, number>();
  for (const it of prevItems) byCatPrev.set(it.category, (byCatPrev.get(it.category) ?? 0) + Number(it.price));
  const compare = catData.map((d) => {
    const prev = byCatPrev.get(d.cat) ?? 0;
    const delta = prev > 0 ? ((d.val - prev) / prev) * 100 : (d.val > 0 ? 100 : 0);
    return { ...d, prev, delta };
  });

  // Daily bar chart
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const dailyMap = new Array(daysInMonth).fill(0);
  for (const it of items) {
    const d = new Date(it.bill_date);
    if (d.getMonth() === cursor.m && d.getFullYear() === cursor.y) {
      dailyMap[d.getDate() - 1] += Number(it.price);
    }
  }
  const dailyData = dailyMap.map((val, i) => ({ name: String(i + 1), val }));

  // Bills grouped by week
  const weeks: Record<string, typeof bills> = {};
  for (const b of bills) {
    const d = new Date(b.bill_date);
    const wk = Math.floor((d.getDate() - 1) / 7) + 1;
    const key = `Week ${wk}`;
    (weeks[key] ??= []).push(b);
  }

  const monthLabel = start.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const isCurrent = cursor.y === today.getFullYear() && cursor.m === today.getMonth();
  const totalDelta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;

  return (
    <div className="px-5 pt-8 pb-32 space-y-6">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCursor((c) => ({ y: c.m === 0 ? c.y - 1 : c.y, m: c.m === 0 ? 11 : c.m - 1 }))}
          className="glass h-10 w-10 flex items-center justify-center"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Monthly report</p>
          <h1 className="text-xl font-bold">{monthLabel}</h1>
        </div>
        <button
          onClick={() => setCursor((c) => ({ y: c.m === 11 ? c.y + 1 : c.y, m: c.m === 11 ? 0 : c.m + 1 }))}
          disabled={isCurrent}
          className="glass h-10 w-10 flex items-center justify-center disabled:opacity-40"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Big total */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-strong p-6 text-center relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Total spent</p>
        <p className="text-5xl font-bold tabular mt-2">{fmt(total)}</p>
        {prevTotal > 0 && (
          <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${totalDelta > 0 ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"}`}>
            {totalDelta > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(totalDelta).toFixed(1)}% vs last month ({fmt(prevTotal)})
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">{bills.length} bill{bills.length === 1 ? "" : "s"}</p>
      </motion.div>

      {/* Donut */}
      {catData.length > 0 && (
        <div className="glass-strong p-4">
          <h2 className="font-semibold mb-3">By category</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={catData} dataKey="val" nameKey="cat" innerRadius={55} outerRadius={90} paddingAngle={2} animationDuration={900}>
                  {catData.map((d) => (<Cell key={d.cat} fill={d.meta.color} />))}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-3">
            {catData.map((d) => (
              <Link key={d.cat} to={"/category/$key" as "/home"} params={{ key: d.cat } as never} className="flex items-center gap-2 text-xs hover:bg-white/5 rounded-md px-2 py-1.5 -mx-2 transition">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ background: d.meta.color }} />
                <span className="truncate flex-1 font-medium">{d.meta.label}</span>
                <span className="text-muted-foreground tabular">{d.pct.toFixed(1)}%</span>
                <span className="tabular font-semibold w-20 text-right">{fmt(d.val)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Daily bar chart */}
      {dailyData.some((d) => d.val > 0) && (
        <div className="glass-strong p-4">
          <h2 className="font-semibold mb-3">Daily spending</h2>
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={dailyData}>
                <XAxis dataKey="name" stroke="oklch(0.7 0.03 260)" fontSize={10} interval={2} />
                <Tooltip formatter={(v) => fmt(Number(v))} labelFormatter={(l) => `Day ${l}`} contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Bar dataKey="val" fill="oklch(0.72 0.17 165)" radius={[4, 4, 0, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* MoM comparison */}
      {compare.length > 0 && prevTotal > 0 && (
        <div>
          <h2 className="font-semibold mb-2">vs last month</h2>
          <div className="space-y-2">
            {compare.map((d) => (
              <div key={d.cat} className="glass p-3 flex items-center gap-3">
                <CategoryIcon category={d.cat} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{d.meta.label}</p>
                  <p className="text-[11px] text-muted-foreground tabular">{fmt(d.prev)} → {fmt(d.val)}</p>
                </div>
                <div className={`flex items-center gap-1 text-xs font-semibold tabular ${
                  Math.abs(d.delta) < 1 ? "text-muted-foreground" : d.delta > 0 ? "text-rose-300" : "text-emerald-300"
                }`}>
                  {Math.abs(d.delta) < 1 ? <Minus className="h-3 w-3" /> : d.delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {d.delta > 0 ? "+" : ""}{d.delta.toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bills grouped by week */}
      {bills.length > 0 && (
        <div>
          <h2 className="font-semibold mb-2">Bills this month</h2>
          <div className="space-y-4">
            {Object.entries(weeks).map(([week, list]) => {
              const wkTotal = list.reduce((s, b) => s + Number(b.total), 0);
              return (
                <div key={week}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{week}</p>
                    <p className="text-xs tabular text-muted-foreground">{fmt(wkTotal)}</p>
                  </div>
                  <div className="space-y-2">
                    {list.map((b) => (
                      <div key={b.id} className="glass flex items-center gap-3 p-3">
                        <CategoryIcon category={b.category} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{b.store}</p>
                          <p className="text-[11px] text-muted-foreground">{shortDate(b.bill_date)}</p>
                        </div>
                        <p className="tabular font-semibold">{money(b.total, b.currency ?? "INR")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {bills.length === 0 && (
        <div className="glass p-6 text-center text-sm text-muted-foreground">
          No bills for {monthLabel}.
        </div>
      )}
    </div>
  );
}