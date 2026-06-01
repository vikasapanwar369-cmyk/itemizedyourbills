import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { CategoryIcon } from "@/components/CategoryIcon";
import { CountUp } from "@/components/CountUp";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — BillSnap" }] }),
  component: ReportsPage,
});

type Range = "week" | "month" | "year";

function rangeStart(r: Range): Date {
  const d = new Date();
  if (r === "week") d.setDate(d.getDate() - 7);
  else if (r === "month") d.setMonth(d.getMonth() - 1);
  else d.setFullYear(d.getFullYear() - 1);
  return d;
}

function ReportsPage() {
  const [range, setRange] = useState<Range>("month");
  const [open, setOpen] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["reports", range],
    queryFn: async () => {
      const from = rangeStart(range).toISOString();
      const [{ data: bills }, { data: items }] = await Promise.all([
        supabase.from("bills").select("id, category, total, bill_date").gte("bill_date", from),
        supabase.from("items").select("category, sub, price, bill_date").gte("bill_date", from),
      ]);
      return { bills: bills ?? [], items: items ?? [] };
    },
  });

  const bills = data?.bills ?? [];
  const items = data?.items ?? [];
  const total = bills.reduce((s, b) => s + Number(b.total), 0);
  const biggest = bills.reduce((m, b) => Math.max(m, Number(b.total)), 0);

  const byCat = new Map<string, number>();
  for (const b of bills) byCat.set(b.category, (byCat.get(b.category) ?? 0) + Number(b.total));
  const catData = Array.from(byCat.entries())
    .map(([cat, val]) => ({ cat, val, meta: getCategory(cat) }))
    .sort((a, b) => b.val - a.val);
  const topCat = catData[0]?.meta.label ?? "—";

  // Bar chart: group by week or month
  const buckets = new Map<string, number>();
  for (const b of bills) {
    const d = new Date(b.bill_date);
    const key = range === "year"
      ? d.toLocaleDateString("en-IN", { month: "short" })
      : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    buckets.set(key, (buckets.get(key) ?? 0) + Number(b.total));
  }
  const barData = Array.from(buckets.entries()).map(([name, val]) => ({ name, val }));

  // subcategory breakdown
  const subs = new Map<string, Map<string, number>>();
  for (const it of items) {
    if (!subs.has(it.category)) subs.set(it.category, new Map());
    const m = subs.get(it.category)!;
    m.set(it.sub, (m.get(it.sub) ?? 0) + Number(it.price));
  }

  return (
    <div className="px-5 pt-8 space-y-5">
      <h1 className="text-2xl font-bold">Reports</h1>

      <div className="flex gap-2 p-1 rounded-xl bg-white/5 border border-white/10">
        {(["week", "month", "year"] as Range[]).map((r) => (
          <button key={r} onClick={() => setRange(r)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${range === r ? "bg-white/10" : "text-muted-foreground"}`}>
            {r === "week" ? "Week" : r === "month" ? "Month" : "Year"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass p-4">
          <p className="text-xs text-muted-foreground">Total spent</p>
          <CountUp to={total} prefix="₹" className="text-2xl font-bold mt-1 block" />
        </div>
        <div className="glass p-4">
          <p className="text-xs text-muted-foreground">Bills</p>
          <CountUp to={bills.length} className="text-2xl font-bold mt-1 block" />
        </div>
        <div className="glass p-4">
          <p className="text-xs text-muted-foreground">Top category</p>
          <p className="text-lg font-bold mt-1 truncate">{topCat}</p>
        </div>
        <div className="glass p-4">
          <p className="text-xs text-muted-foreground">Biggest bill</p>
          <CountUp to={biggest} prefix="₹" className="text-2xl font-bold mt-1 block" />
        </div>
      </div>

      {catData.length > 0 && (
        <div className="glass-strong p-4">
          <h2 className="font-semibold mb-3">By category</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={catData} dataKey="val" nameKey="cat" innerRadius={50} outerRadius={90} paddingAngle={2} animationDuration={900}>
                  {catData.map((d) => (<Cell key={d.cat} fill={d.meta.color} />))}
                </Pie>
                <Tooltip formatter={(v) => inr(Number(v))} contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {catData.map((d) => (
              <div key={d.cat} className="flex items-center gap-2 text-xs">
                <span className="h-3 w-3 rounded-full" style={{ background: d.meta.color }} />
                <span className="truncate flex-1">{d.meta.label}</span>
                <span className="tabular text-muted-foreground">{inr(d.val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {barData.length > 0 && (
        <div className="glass-strong p-4">
          <h2 className="font-semibold mb-3">Over time</h2>
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={barData}>
                <XAxis dataKey="name" stroke="oklch(0.7 0.03 260)" fontSize={11} />
                <Tooltip formatter={(v) => inr(Number(v))} contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Bar dataKey="val" fill="oklch(0.62 0.25 295)" radius={[6, 6, 0, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="font-semibold">Category breakdown</h2>
        {catData.map((d) => {
          const pct = total > 0 ? (d.val / total) * 100 : 0;
          const isOpen = open === d.cat;
          const sub = subs.get(d.cat);
          return (
            <motion.div key={d.cat} layout className="glass p-3">
              <button onClick={() => setOpen(isOpen ? null : d.cat)} className="w-full flex items-center gap-3">
                <CategoryIcon category={d.cat} size="sm" />
                <div className="flex-1 text-left">
                  <div className="flex justify-between">
                    <p className="font-medium">{d.meta.label}</p>
                    <p className="tabular font-semibold">{inr(d.val)}</p>
                  </div>
                  <div className="h-1.5 mt-1.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ background: d.meta.color }}
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
                  </div>
                </div>
              </button>
              {isOpen && sub && (
                <div className="mt-3 pl-12 space-y-1">
                  {Array.from(sub.entries()).sort((a, b) => b[1] - a[1]).map(([s, v]) => (
                    <div key={s} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{s}</span>
                      <span className="tabular">{inr(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
        {!catData.length && <div className="glass p-6 text-center text-sm text-muted-foreground">No data yet — scan a bill to see reports.</div>}
      </div>
    </div>
  );
}