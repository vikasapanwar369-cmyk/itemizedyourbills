import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Download, Trash2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CategoryIcon } from "@/components/CategoryIcon";
import { inr, fullDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History — BillSnap" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const { data: bills = [] } = useQuery({
    queryKey: ["history"],
    queryFn: async () => {
      const { data } = await supabase.from("bills").select("id, store, bill_date, category, total").order("bill_date", { ascending: false });
      return data ?? [];
    },
  });

  const { data: itemsByBill = {} } = useQuery({
    queryKey: ["history-items"],
    queryFn: async () => {
      const { data } = await supabase.from("items").select("bill_id, name, brand, qty, unit, price, sub");
      const grouped: Record<string, typeof data> = {};
      for (const it of data ?? []) {
        (grouped[it.bill_id] ??= []).push(it);
      }
      return grouped;
    },
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return bills;
    return bills.filter((b) => b.store.toLowerCase().includes(s) || b.category.toLowerCase().includes(s));
  }, [bills, q]);

  async function del(id: string) {
    if (!confirm("Delete this bill?")) return;
    const { error } = await supabase.from("bills").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      qc.invalidateQueries();
    }
  }

  function exportCsv() {
    const rows = [["Date", "Store", "Category", "Item", "Brand", "Qty", "Unit", "Price"]];
    for (const b of filtered) {
      const its = itemsByBill[b.id] ?? [];
      if (!its.length) rows.push([fullDate(b.bill_date), b.store, b.category, "", "", "", "", String(b.total)]);
      for (const it of its) rows.push([fullDate(b.bill_date), b.store, b.category, it.name, it.brand, String(it.qty), it.unit, String(it.price)]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `billsnap-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="px-5 pt-8 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">History</h1>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="glass p-2" aria-label="Export"><Download className="h-4 w-4" /></button>
          <button onClick={signOut} className="glass p-2" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="glass flex items-center gap-2 px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          placeholder="Search store or category"
          value={q} onChange={(e) => setQ(e.target.value)}
          className="flex-1 bg-transparent outline-none text-sm py-1"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="glass p-6 text-center text-sm text-muted-foreground">No bills found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((b, i) => {
            const isOpen = open === b.id;
            const items = itemsByBill[b.id] ?? [];
            return (
              <motion.div key={b.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className="glass p-3">
                <button className="w-full flex items-center gap-3" onClick={() => setOpen(isOpen ? null : b.id)}>
                  <CategoryIcon category={b.category} size="sm" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium truncate">{b.store}</p>
                    <p className="text-xs text-muted-foreground">{fullDate(b.bill_date)} · {items.length} item{items.length === 1 ? "" : "s"}</p>
                  </div>
                  <p className="tabular font-semibold">{inr(b.total)}</p>
                </button>
                {isOpen && (
                  <div className="mt-3 border-t border-white/10 pt-3 space-y-1.5">
                    {items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="truncate pr-2">{it.name} <span className="text-muted-foreground text-xs">· {it.brand} · {it.qty}{it.unit}</span></span>
                        <span className="tabular text-muted-foreground">{inr(it.price)}</span>
                      </div>
                    ))}
                    <button onClick={() => del(b.id)} className="mt-2 text-xs text-rose-300 flex items-center gap-1">
                      <Trash2 className="h-3.5 w-3.5" /> Delete bill
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}