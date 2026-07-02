import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { CATEGORIES, getCategory, type CategoryKey } from "@/lib/categories";
import { CategoryIcon } from "@/components/CategoryIcon";
import { money } from "@/lib/format";
import { getBudgetsWithProgress, upsertBudget, deleteBudget } from "@/lib/budgets.functions";

export const Route = createFileRoute("/_authenticated/budgets")({
  head: () => ({ meta: [{ title: "Budgets — BillSnap" }] }),
  component: BudgetsPage,
});

function BudgetsPage() {
  const qc = useQueryClient();
  const fetchBudgets = useServerFn(getBudgetsWithProgress);
  const upsertFn = useServerFn(upsertBudget);
  const deleteFn = useServerFn(deleteBudget);
  const { data } = useQuery({ queryKey: ["budgets"], queryFn: () => fetchBudgets() });
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState<CategoryKey>("grocery");
  const [newLimit, setNewLimit] = useState("");

  const upsert = useMutation({
    mutationFn: (p: { category: string; monthlyLimit: number }) => upsertFn({ data: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });

  const budgets = data?.budgets ?? [];
  const currency = data?.primaryCurrency ?? "INR";
  const usedCats = new Set(budgets.map((b) => b.category));
  const available = Object.values(CATEGORIES).filter((c) => !usedCats.has(c.key) && c.key !== "other");

  return (
    <div className="px-5 pt-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-xs text-muted-foreground">Set a monthly cap per category</p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="glass h-10 px-4 flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> New
        </button>
      </div>

      {adding && available.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="glass-strong p-4 space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Category</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {available.slice(0, 20).map((c) => (
                <button key={c.key} onClick={() => setNewCat(c.key)}
                  className={`rounded-full px-3 py-1.5 text-xs border ${newCat === c.key ? "bg-violet-500/25 border-violet-400/50" : "bg-white/5 border-white/10"}`}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Monthly limit ({currency})</label>
            <input type="number" inputMode="decimal" value={newLimit} onChange={(e) => setNewLimit(e.target.value)}
              placeholder="e.g. 8000"
              className="mt-2 w-full glass px-3 py-2 text-sm bg-transparent outline-none" />
          </div>
          <div className="flex gap-2">
            <button
              disabled={!newLimit || Number(newLimit) <= 0 || upsert.isPending}
              onClick={() => {
                upsert.mutate(
                  { category: newCat, monthlyLimit: Number(newLimit) },
                  { onSuccess: () => { setNewLimit(""); setAdding(false); } }
                );
              }}
              className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
              {upsert.isPending ? "Saving…" : "Save budget"}
            </button>
            <button onClick={() => setAdding(false)} className="glass px-4 text-sm">Cancel</button>
          </div>
        </motion.div>
      )}

      {budgets.length === 0 && !adding ? (
        <div className="glass p-8 text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
            <TrendingUp className="h-7 w-7 text-white" />
          </div>
          <p className="font-semibold">Cap your monthly spend</p>
          <p className="text-xs text-muted-foreground">Add a budget per category and we'll track pace, projection, and overspend for you.</p>
          <button onClick={() => setAdding(true)} className="mt-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 px-5 py-2 text-sm font-semibold text-white">
            Add your first budget
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((b, i) => {
            const meta = getCategory(b.category);
            const barColor = b.status === "over" ? "bg-rose-400" : b.status === "watch" ? "bg-amber-400" : "bg-emerald-400";
            const statusLabel = b.status === "over" ? "Over budget" : b.status === "watch" ? "Ahead of pace" : "On track";
            const statusCls = b.status === "over" ? "bg-rose-500/15 text-rose-300 border-rose-400/30"
              : b.status === "watch" ? "bg-amber-500/15 text-amber-300 border-amber-400/30"
              : "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
            return (
              <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="glass p-4">
                <div className="flex items-start gap-3">
                  <CategoryIcon category={b.category} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{meta.label}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusCls}`}>{statusLabel}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 tabular">
                      {money(b.spent, b.currency)} of {money(b.limit, b.currency)} · {money(b.remaining, b.currency)} left
                    </p>
                  </div>
                  <button onClick={() => del.mutate(b.id)} aria-label="Delete budget"
                    className="text-muted-foreground hover:text-rose-300 p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, b.pct)}%` }}
                    transition={{ duration: 0.6 }} className={`h-full ${barColor}`} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground tabular">
                  <span>{b.pct.toFixed(0)}% used</span>
                  {b.projected > 0 && <span>Projected: {money(b.projected, b.currency)}</span>}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}