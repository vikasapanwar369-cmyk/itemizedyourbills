import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { money, daysBetween } from "@/lib/format";
import { ItemDetailSheet } from "@/components/ItemDetailSheet";

export const Route = createFileRoute("/_authenticated/consumption")({
  head: () => ({ meta: [{ title: "Consumption — BillSnap" }] }),
  component: ConsumptionPage,
});

function ConsumptionPage() {
  const [filter, setFilter] = useState<string>("all");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["consumption"],
    queryFn: async () => {
      const { data } = await supabase
        .from("items")
        .select("name, canonical_name, brand, qty, unit, price, sub, category, bill_date, bill:bills(currency)")
        .order("bill_date", { ascending: false })
        .limit(1000);
      return (data ?? []) as Array<{
        name: string; canonical_name: string | null; brand: string; qty: number; unit: string; price: number;
        sub: string; category: string; bill_date: string; bill?: { currency: string } | null;
      }>;
    },
  });

  // Primary currency = most common across loaded items.
  const cc = new Map<string, number>();
  for (const it of items) {
    const c = it.bill?.currency ?? "INR";
    cc.set(c, (cc.get(c) ?? 0) + 1);
  }
  const currency = [...cc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "INR";

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((it) => it.category === filter)),
    [items, filter]
  );

  // group by name+brand
  const groups = useMemo(() => {
    const norm = (s: string) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    const map = new Map<string, { key: string; name: string; brand: string; sub: string; unit: string; category: string; qty: number; spend: number; count: number; dates: string[] }>();
    for (const it of filtered) {
      const canon = it.canonical_name && it.canonical_name.trim() ? norm(it.canonical_name) : "";
      const key = canon || `${norm(it.name)}|${norm(it.brand)}`;
      const g = map.get(key) ?? { key, name: it.name, brand: it.brand, sub: it.sub, unit: it.unit, category: it.category, qty: 0, spend: 0, count: 0, dates: [] };
      g.qty += Number(it.qty);
      g.spend += Number(it.price);
      g.count += 1;
      g.dates.push(it.bill_date);
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
  }, [filtered]);

  return (
    <div className="px-5 pt-8 space-y-5">
      <h1 className="text-2xl font-bold">Consumption</h1>

      <div className="-mx-5 px-5 no-scrollbar overflow-x-auto">
        <div className="flex gap-2 w-max">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
          {Object.values(CATEGORIES).map((c) => (
            <Chip key={c.key} active={filter === c.key} onClick={() => setFilter(c.key)}>
              {c.emoji} {c.label}
            </Chip>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="glass p-6 text-center text-sm text-muted-foreground">Nothing logged here yet.</div>
      ) : (
        <div className="space-y-2">
          {groups.map((g, i) => {
            const sortedDates = g.dates.map((d) => new Date(d)).sort((a, b) => b.getTime() - a.getTime());
            let avgDays = 0;
            if (sortedDates.length >= 2) {
              const diffs = sortedDates.slice(1).map((d, idx) => daysBetween(sortedDates[idx], d));
              avgDays = Math.round(diffs.reduce((s, x) => s + x, 0) / diffs.length);
            }
            return (
              <motion.div key={g.key} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="glass p-4">
                <button className="w-full text-left" onClick={() => setOpenKey(g.key)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{g.brand}</p>
                      <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10">{g.sub}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold tabular">{g.qty.toFixed(g.qty % 1 === 0 ? 0 : 2)}<span className="text-sm text-muted-foreground ml-1">{g.unit}</span></p>
                      <p className="tabular text-sm text-emerald-300">{money(g.spend, currency)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span>Bought {g.count}×</span>
                    {avgDays > 0 && <span>· Every ~{avgDays} day{avgDays === 1 ? "" : "s"}</span>}
                    <span>· {getCategory(g.category).label}</span>
                    <span className="ml-auto text-violet-300">View details →</span>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      <ItemDetailSheet itemKey={openKey} onClose={() => setOpenKey(null)} />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition ${
        active ? "bg-violet-500/20 border-violet-400/40 text-foreground" : "bg-white/5 border-white/10 text-muted-foreground"
      }`}>
      {children}
    </button>
  );
}