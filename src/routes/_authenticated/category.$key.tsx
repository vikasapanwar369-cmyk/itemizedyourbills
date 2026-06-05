import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Trophy, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CategoryIcon } from "@/components/CategoryIcon";
import { getCategory } from "@/lib/categories";
import { money, fullDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/category/$key")({
  head: ({ params }) => ({ meta: [{ title: `${getCategory(params.key).label} — BillSnap` }] }),
  component: CategoryDetailPage,
});

type Period = "7d" | "month" | "3m" | "year" | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "month", label: "This month" },
  { key: "3m", label: "3 months" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
];

function periodStart(p: Period): Date | null {
  const d = new Date();
  switch (p) {
    case "7d": d.setDate(d.getDate() - 7); return d;
    case "month": return new Date(d.getFullYear(), d.getMonth(), 1);
    case "3m": d.setMonth(d.getMonth() - 3); return d;
    case "year": return new Date(d.getFullYear(), 0, 1);
    case "all": return null;
  }
}

function CategoryDetailPage() {
  const { key } = Route.useParams();
  const meta = getCategory(key);
  const [period, setPeriod] = useState<Period>("month");

  const { data: items = [] } = useQuery({
    queryKey: ["category-items", key],
    queryFn: async () => {
      const { data } = await supabase
        .from("items")
        .select("id, name, brand, qty, unit, price, unit_price, bill_date, canonical_name, bill:bills(store, currency)")
        .eq("category", key)
        .order("bill_date", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const from = periodStart(period);
    if (!from) return items;
    return items.filter((it) => new Date(it.bill_date) >= from);
  }, [items, period]);

  const currency = useMemo(() => {
    const counts = new Map<string, number>();
    for (const it of filtered) {
      const c = (it.bill as { currency?: string } | null)?.currency ?? "INR";
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "INR";
  }, [filtered]);
  const fmt = (v: number) => money(v, currency);

  const total = filtered.reduce((s, it) => s + Number(it.price), 0);

  // Most bought: group by canonical_name or name|brand
  const countMap = new Map<string, { name: string; qty: number; count: number }>();
  for (const it of filtered) {
    const k = (it.canonical_name || `${it.name}|${it.brand}`).toLowerCase();
    const prev = countMap.get(k) ?? { name: it.name, qty: 0, count: 0 };
    prev.qty += Number(it.qty);
    prev.count += 1;
    countMap.set(k, prev);
  }
  const mostBought = [...countMap.values()].sort((a, b) => b.count - a.count)[0] ?? null;

  // Most expensive single purchase
  const mostExpensive = filtered.reduce<typeof filtered[number] | null>((m, it) => (!m || Number(it.price) > Number(m.price) ? it : m), null);

  return (
    <div className="px-5 pt-8 pb-32 space-y-6">
      <div className="flex items-center gap-3">
        <Link to={"/reports" as "/home"} className="glass h-10 w-10 flex items-center justify-center" aria-label="Back">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <CategoryIcon category={key} size="md" />
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Category</p>
          <h1 className="text-2xl font-bold">{meta.label}</h1>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition border ${
              period === p.key
                ? "bg-white/10 border-white/20 text-foreground"
                : "bg-white/5 border-white/5 text-muted-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="glass-strong p-5 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full blur-3xl" style={{ background: meta.color, opacity: 0.2 }} />
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Total spent</p>
        <p className="text-4xl font-bold tabular mt-1">{fmt(total)}</p>
        <p className="text-xs text-muted-foreground mt-1">{filtered.length} purchase{filtered.length === 1 ? "" : "s"}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass p-4">
          <div className="flex items-center gap-1.5 text-amber-300">
            <Flame className="h-3.5 w-3.5" />
            <p className="text-[11px] uppercase tracking-wider">Most bought</p>
          </div>
          <p className="text-sm font-semibold mt-2 truncate">{mostBought?.name ?? "—"}</p>
          <p className="text-[11px] text-muted-foreground">{mostBought ? `${mostBought.count}× purchases` : "No data"}</p>
        </div>
        <div className="glass p-4">
          <div className="flex items-center gap-1.5 text-violet-300">
            <Trophy className="h-3.5 w-3.5" />
            <p className="text-[11px] uppercase tracking-wider">Most expensive</p>
          </div>
          <p className="text-sm font-semibold mt-2 truncate">{mostExpensive?.name ?? "—"}</p>
          <p className="text-[11px] text-muted-foreground tabular">{mostExpensive ? fmt(Number(mostExpensive.price)) : "No data"}</p>
        </div>
      </div>

      {/* Item list */}
      <div>
        <h2 className="font-semibold mb-2">All purchases</h2>
        {filtered.length === 0 ? (
          <div className="glass p-6 text-center text-sm text-muted-foreground">
            No items in this category for the selected period.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((it, i) => (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}
                className="glass p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{it.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {it.brand !== "Local" ? `${it.brand} · ` : ""}{(it.bill as { store?: string } | null)?.store ?? "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground tabular mt-0.5">
                      {Number(it.qty)} {it.unit} · {money(Number(it.unit_price), currency, undefined, { precise: true })}/{it.unit} · {fullDate(it.bill_date)}
                    </p>
                  </div>
                  <p className="tabular font-semibold">{money(Number(it.price), currency)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}