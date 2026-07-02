import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Wand2, CheckCircle2, Circle, Store } from "lucide-react";
import { CATEGORIES, getCategory, type CategoryKey } from "@/lib/categories";
import { CategoryIcon } from "@/components/CategoryIcon";
import { money } from "@/lib/format";
import {
  getShoppingList, addShoppingItem, toggleShoppingItem, deleteShoppingItem,
  clearCheckedShopping, generateFromRefills,
} from "@/lib/shopping.functions";

export const Route = createFileRoute("/_authenticated/shopping")({
  head: () => ({ meta: [{ title: "Shopping list — BillSnap" }] }),
  component: ShoppingPage,
});

function ShoppingPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(getShoppingList);
  const addFn = useServerFn(addShoppingItem);
  const toggleFn = useServerFn(toggleShoppingItem);
  const delFn = useServerFn(deleteShoppingItem);
  const clearFn = useServerFn(clearCheckedShopping);
  const genFn = useServerFn(generateFromRefills);

  const { data: items = [] } = useQuery({ queryKey: ["shopping"], queryFn: () => fetchList() });
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [cat, setCat] = useState<CategoryKey>("grocery");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["shopping"] });
  const add = useMutation({ mutationFn: (p: Parameters<typeof addFn>[0]) => addFn(p), onSuccess: invalidate });
  const toggle = useMutation({ mutationFn: (p: { id: string; checked: boolean }) => toggleFn({ data: p }), onSuccess: invalidate });
  const del = useMutation({ mutationFn: (id: string) => delFn({ data: { id } }), onSuccess: invalidate });
  const clear = useMutation({ mutationFn: () => clearFn(), onSuccess: invalidate });
  const generate = useMutation({ mutationFn: () => genFn(), onSuccess: invalidate });

  const pending = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);
  const estimatedCost = useMemo(
    () => pending.reduce((s, i) => s + Number(i.qty) * Number(i.last_price ?? 0), 0),
    [pending]
  );
  // Group pending by their usual store for a store-aware view
  const byStore = useMemo(() => {
    const m = new Map<string, typeof pending>();
    for (const i of pending) {
      const key = i.last_store || "Add to any store";
      const arr = m.get(key) ?? [];
      arr.push(i);
      m.set(key, arr);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [pending]);

  return (
    <div className="px-5 pt-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shopping list</h1>
          <p className="text-xs text-muted-foreground">
            {pending.length} to buy · est. {money(estimatedCost, "INR")}
          </p>
        </div>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="glass h-10 px-4 flex items-center gap-2 text-sm font-medium">
          <Wand2 className="h-4 w-4 text-violet-300" />
          {generate.isPending ? "Scanning…" : "Auto-add refills"}
        </button>
      </div>

      {/* Quick add */}
      <div className="glass p-3 space-y-2">
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add item…"
            className="flex-1 bg-transparent outline-none px-2 text-sm" />
          <input value={qty} onChange={(e) => setQty(e.target.value)} type="number" min="1"
            className="w-14 bg-white/5 rounded-lg outline-none px-2 text-sm text-center tabular" />
          <button
            disabled={!name.trim() || add.isPending}
            onClick={() => {
              add.mutate(
                { data: { name: name.trim(), qty: Number(qty) || 1, category: cat, unit: "pcs" } },
                { onSuccess: () => { setName(""); setQty("1"); } }
              );
            }}
            className="rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-600 px-3 text-sm text-white disabled:opacity-40">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {(["grocery", "produce", "dairy", "household", "hygiene", "medicine", "beverages", "snacks"] as CategoryKey[]).map((k) => (
            <button key={k} onClick={() => setCat(k)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] border ${cat === k ? "bg-violet-500/20 border-violet-400/40" : "bg-white/5 border-white/10 text-muted-foreground"}`}>
              {CATEGORIES[k].emoji} {CATEGORIES[k].label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="glass p-8 text-center space-y-2">
          <div className="text-4xl">🛒</div>
          <p className="font-semibold">Your list is empty</p>
          <p className="text-xs text-muted-foreground">Tap <span className="text-violet-300 font-medium">Auto-add refills</span> to pull items that are due based on your usage.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {byStore.map(([store, arr]) => (
            <div key={store} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Store className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{store}</p>
                <span className="text-[10px] text-muted-foreground">· {arr.length}</span>
              </div>
              <AnimatePresence initial={false}>
                {arr.map((i) => (
                  <motion.div key={i.id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                    className="glass flex items-center gap-3 p-3">
                    <button onClick={() => toggle.mutate({ id: i.id, checked: true })} aria-label="Check off">
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    </button>
                    <CategoryIcon category={i.category} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{i.name}</p>
                        {i.source !== "manual" && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${i.source === "overdue" ? "bg-rose-500/15 text-rose-300 border-rose-400/30" : "bg-amber-500/15 text-amber-300 border-amber-400/30"}`}>
                            {i.source === "overdue" ? "Overdue" : "Refill"}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {i.brand ? `${i.brand} · ` : ""}Qty {Number(i.qty)} {i.unit}
                        {i.last_price ? ` · last ${money(Number(i.last_price), "INR")}` : ""}
                      </p>
                    </div>
                    <button onClick={() => del.mutate(i.id)} aria-label="Remove" className="text-muted-foreground hover:text-rose-300 p-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ))}

          {done.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">In cart · {done.length}</p>
                <button onClick={() => clear.mutate()} className="text-[11px] text-rose-300">Clear</button>
              </div>
              {done.map((i) => (
                <div key={i.id} className="glass flex items-center gap-3 p-3 opacity-60">
                  <button onClick={() => toggle.mutate({ id: i.id, checked: false })}>
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </button>
                  <p className="flex-1 line-through text-sm">{i.name}</p>
                  <span className="text-[11px] text-muted-foreground tabular">{getCategory(i.category).label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}