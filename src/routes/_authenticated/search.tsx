import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search as SearchIcon, X, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CategoryIcon } from "@/components/CategoryIcon";
import { CATEGORIES, CATEGORY_KEYS, getCategory } from "@/lib/categories";
import { money, fullDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Search — BillSnap" }] }),
  component: SearchPage,
});

type SortKey = "date" | "price" | "qty";
type DateRange = "all" | "7d" | "30d" | "90d" | "year";

const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "7d", label: "Last 7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "year", label: "This year" },
];

function dateFrom(r: DateRange): Date | null {
  const d = new Date();
  switch (r) {
    case "7d": d.setDate(d.getDate() - 7); return d;
    case "30d": d.setDate(d.getDate() - 30); return d;
    case "90d": d.setDate(d.getDate() - 90); return d;
    case "year": return new Date(d.getFullYear(), 0, 1);
    case "all": return null;
  }
}

function SearchPage() {
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [store, setStore] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<string>("");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("date");

  const { data: items = [] } = useQuery({
    queryKey: ["search-items"],
    queryFn: async () => {
      const { data } = await supabase
        .from("items")
        .select("id, name, brand, company, category, sub, qty, unit, price, unit_price, bill_date, bill:bills(store, payment_mode, currency)")
        .order("bill_date", { ascending: false })
        .limit(1000);
      return data ?? [];
    },
  });

  const stores = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) {
      const st = (it.bill as { store?: string } | null)?.store;
      if (st) s.add(st);
    }
    return [...s].sort();
  }, [items]);

  const paymentModes = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) {
      const p = (it.bill as { payment_mode?: string } | null)?.payment_mode;
      if (p && p !== "unknown") s.add(p);
    }
    return [...s].sort();
  }, [items]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const from = dateFrom(dateRange);
    const minP = priceMin ? Number(priceMin) : null;
    const maxP = priceMax ? Number(priceMax) : null;
    let r = items.filter((it) => {
      const b = it.bill as { store?: string; payment_mode?: string } | null;
      if (term) {
        const hay = `${it.name} ${it.brand} ${it.company ?? ""} ${it.category} ${it.sub}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (category && it.category !== category) return false;
      if (store && b?.store !== store) return false;
      if (paymentMode && b?.payment_mode !== paymentMode) return false;
      if (from && new Date(it.bill_date) < from) return false;
      if (minP !== null && Number(it.price) < minP) return false;
      if (maxP !== null && Number(it.price) > maxP) return false;
      return true;
    });
    r = r.slice().sort((a, b) => {
      if (sort === "price") return Number(b.price) - Number(a.price);
      if (sort === "qty") return Number(b.qty) - Number(a.qty);
      return new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime();
    });
    return r;
  }, [items, q, category, store, paymentMode, dateRange, priceMin, priceMax, sort]);

  const activeFilterCount = [category, store, paymentMode, dateRange !== "all" ? dateRange : "", priceMin, priceMax].filter(Boolean).length;

  function reset() {
    setCategory(""); setStore(""); setPaymentMode(""); setDateRange("all"); setPriceMin(""); setPriceMax("");
  }

  return (
    <div className="px-5 pt-8 pb-32 space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Find anything</p>
        <h1 className="text-2xl font-bold">Search</h1>
      </div>

      {/* Search input */}
      <div className="glass-strong flex items-center gap-2 px-4 py-3">
        <SearchIcon className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Product, brand, or category…"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Clear">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowFilters((s) => !s)}
          className="glass px-3 py-2 text-xs font-medium flex items-center gap-1.5"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 rounded-full bg-violet-500/30 text-violet-200 px-1.5 text-[10px]">{activeFilterCount}</span>
          )}
        </button>
        <div className="flex-1" />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="glass px-3 py-2 text-xs font-medium bg-transparent"
        >
          <option value="date">Newest</option>
          <option value="price">Highest price</option>
          <option value="qty">Quantity</option>
        </select>
      </div>

      {showFilters && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="glass p-4 space-y-4">
          {/* Date */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Date range</p>
            <div className="flex flex-wrap gap-1.5">
              {DATE_RANGES.map((d) => (
                <button key={d.key} onClick={() => setDateRange(d.key)}
                  className={`px-2.5 py-1.5 rounded-full text-[11px] border ${dateRange === d.key ? "bg-white/10 border-white/20" : "bg-white/5 border-white/5 text-muted-foreground"}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Category</p>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setCategory("")}
                className={`px-2.5 py-1.5 rounded-full text-[11px] border ${!category ? "bg-white/10 border-white/20" : "bg-white/5 border-white/5 text-muted-foreground"}`}>
                All
              </button>
              {CATEGORY_KEYS.filter((k, i, arr) => arr.indexOf(k) === i).slice(0, 14).map((k) => (
                <button key={k} onClick={() => setCategory(category === k ? "" : k)}
                  className={`px-2.5 py-1.5 rounded-full text-[11px] border ${category === k ? "bg-white/10 border-white/20" : "bg-white/5 border-white/5 text-muted-foreground"}`}>
                  {CATEGORIES[k].emoji} {CATEGORIES[k].label}
                </button>
              ))}
            </div>
          </div>

          {/* Store */}
          {stores.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Store</p>
              <select value={store} onChange={(e) => setStore(e.target.value)} className="w-full glass px-3 py-2 text-xs bg-transparent">
                <option value="">All stores</option>
                {stores.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Payment */}
          {paymentModes.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Payment mode</p>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setPaymentMode("")}
                  className={`px-2.5 py-1.5 rounded-full text-[11px] border ${!paymentMode ? "bg-white/10 border-white/20" : "bg-white/5 border-white/5 text-muted-foreground"}`}>
                  All
                </button>
                {paymentModes.map((p) => (
                  <button key={p} onClick={() => setPaymentMode(paymentMode === p ? "" : p)}
                    className={`px-2.5 py-1.5 rounded-full text-[11px] border capitalize ${paymentMode === p ? "bg-white/10 border-white/20" : "bg-white/5 border-white/5 text-muted-foreground"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Price */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Price range</p>
            <div className="flex items-center gap-2">
              <input type="number" inputMode="numeric" value={priceMin} onChange={(e) => setPriceMin(e.target.value)}
                placeholder="Min" className="flex-1 glass px-3 py-2 text-sm bg-transparent" />
              <span className="text-muted-foreground text-xs">to</span>
              <input type="number" inputMode="numeric" value={priceMax} onChange={(e) => setPriceMax(e.target.value)}
                placeholder="Max" className="flex-1 glass px-3 py-2 text-sm bg-transparent" />
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button onClick={reset} className="w-full glass-strong py-2 text-xs font-medium">Clear all filters</button>
          )}
        </motion.div>
      )}

      {/* Results */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">{results.length} result{results.length === 1 ? "" : "s"}</p>
        <div className="space-y-2">
          {results.slice(0, 100).map((it, i) => {
            const b = it.bill as { store?: string; currency?: string; payment_mode?: string } | null;
            const currency = b?.currency ?? "INR";
            return (
              <motion.div key={it.id}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.015, 0.3) }}
                className="glass p-3 flex items-start gap-3"
              >
                <CategoryIcon category={it.category} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{it.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {it.brand !== "Local" ? `${it.brand} · ` : ""}{getCategory(it.category).label} · {b?.store ?? "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular mt-0.5">
                    {Number(it.qty)} {it.unit} · {fullDate(it.bill_date)}
                  </p>
                </div>
                <p className="tabular font-semibold">{money(Number(it.price), currency)}</p>
              </motion.div>
            );
          })}
          {results.length === 0 && (
            <div className="glass p-6 text-center text-sm text-muted-foreground">
              {q || activeFilterCount > 0 ? "No matches. Try a different search or filter." : "Type to search across every item you've ever bought."}
            </div>
          )}
          {results.length > 100 && (
            <p className="text-[11px] text-muted-foreground text-center pt-2">Showing first 100 of {results.length} — narrow filters to see more.</p>
          )}
        </div>
      </div>
    </div>
  );
}