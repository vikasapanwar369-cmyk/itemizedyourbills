import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Camera, TrendingUp, TrendingDown, Sparkles, Repeat, Search, Receipt, Package, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CategoryIcon } from "@/components/CategoryIcon";
import { money, shortDate } from "@/lib/format";
import { getCategory } from "@/lib/categories";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "BillSnap" }] }),
  component: HomePage,
});

function HomePage() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const [{ data: thisItems }, { data: lastItems }, { data: thisBills }, { data: recent }, { data: todayItems }, { data: allItemNames }, { data: allStores }] = await Promise.all([
        supabase.from("items").select("price, bill_date, category").gte("bill_date", monthStart),
        supabase.from("items").select("price").gte("bill_date", lastMonthStart).lt("bill_date", monthStart),
        supabase.from("bills").select("id, currency, store").gte("bill_date", monthStart),
        supabase.from("bills").select("id, store, bill_date, category, total, currency").order("bill_date", { ascending: false }).limit(5),
        supabase.from("items").select("price").gte("bill_date", todayStart),
        supabase.from("items").select("canonical_name, name"),
        supabase.from("bills").select("store"),
      ]);
      const thisTotal = (thisItems ?? []).reduce((s, it) => s + Number(it.price), 0);
      const lastTotal = (lastItems ?? []).reduce((s, it) => s + Number(it.price), 0);
      const todayTotal = (todayItems ?? []).reduce((s, it) => s + Number(it.price), 0);
      const cc = new Map<string, number>();
      for (const b of [...(thisBills ?? []), ...(recent ?? [])]) cc.set(b.currency ?? "INR", (cc.get(b.currency ?? "INR") ?? 0) + 1);
      const currency = [...cc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "INR";
      // top category this month
      const catMap = new Map<string, number>();
      for (const it of thisItems ?? []) catMap.set(it.category, (catMap.get(it.category) ?? 0) + Number(it.price));
      const topCat = [...catMap.entries()].sort((a, b) => b[1] - a[1])[0];
      // unique items + unique stores all-time
      const uniqueItems = new Set((allItemNames ?? []).map((i) => (i.canonical_name || i.name).toLowerCase())).size;
      const uniqueStores = new Set((allStores ?? []).map((b) => (b.store || "").toLowerCase()).filter(Boolean)).size;
      return {
        thisTotal, lastTotal, todayTotal,
        thisMonth: thisBills ?? [], recent: recent ?? [], currency,
        topCat: topCat ? { key: topCat[0], amount: topCat[1] } : null,
        billsThisMonth: (thisBills ?? []).length,
        uniqueItems, uniqueStores,
      };
    },
  });

  const thisTotal = data?.thisTotal ?? 0;
  const lastTotal = data?.lastTotal ?? 0;
  const todayTotal = data?.todayTotal ?? 0;
  const currency = data?.currency ?? "INR";
  const delta = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : 0;
  const up = delta > 0;
  const maxBar = Math.max(thisTotal, lastTotal, 1);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="px-5 pt-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</p>
          <h1 className="text-2xl font-bold mt-0.5">{greet} 👋</h1>
        </div>
        <Link to={"/search" as "/home"} aria-label="Search" className="glass h-10 w-10 flex items-center justify-center">
          <Search className="h-4 w-4" />
        </Link>
      </div>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="glass-strong relative overflow-hidden p-6"
      >
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-violet-500/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />
        <p className="text-xs uppercase tracking-wider text-muted-foreground">This month</p>
        <div className="mt-2 flex items-end gap-3">
          <p className="text-5xl font-bold tabular">{money(thisTotal, currency)}</p>
        </div>
        {lastTotal > 0 && (
          <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${up ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"}`}>
            {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {Math.abs(delta).toFixed(1)}% vs last month
          </div>
        )}
        {/* mini comparison bar chart */}
        <div className="mt-5 flex items-end gap-4 h-20">
          <div className="flex-1 flex flex-col items-center gap-1">
            <motion.div
              initial={{ height: 0 }} animate={{ height: `${(lastTotal / maxBar) * 100}%` }}
              transition={{ duration: 0.8 }}
              className="w-full max-w-12 rounded-t-md bg-white/15"
              style={{ minHeight: 2 }}
            />
            <p className="text-[10px] text-muted-foreground">Last · {money(lastTotal, currency)}</p>
          </div>
          <div className="flex-1 flex flex-col items-center gap-1">
            <motion.div
              initial={{ height: 0 }} animate={{ height: `${(thisTotal / maxBar) * 100}%` }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="w-full max-w-12 rounded-t-md bg-gradient-to-t from-violet-500 to-fuchsia-400"
              style={{ minHeight: 2 }}
            />
            <p className="text-[10px] text-foreground font-medium">This · {money(thisTotal, currency)}</p>
          </div>
        </div>
      </motion.div>

      {/* Today + Top category cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Today</p>
          <p className="text-2xl font-bold mt-1 tabular">{money(todayTotal, currency)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">spent so far</p>
        </div>
        {data?.topCat ? (
          <Link to={"/category/$key" as "/home"} params={{ key: data.topCat.key } as never} className="block">
            <div className="glass p-4 h-full">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Top category</p>
              <div className="mt-1 flex items-center gap-2">
                <CategoryIcon category={data.topCat.key} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{getCategory(data.topCat.key).label}</p>
                  <p className="text-xs text-muted-foreground tabular">{money(data.topCat.amount, currency)}</p>
                </div>
              </div>
            </div>
          </Link>
        ) : (
          <div className="glass p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Top category</p>
            <p className="text-sm text-muted-foreground mt-2">No data yet</p>
          </div>
        )}
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-2">
        <QuickStat icon={<Receipt className="h-4 w-4" />} value={data?.billsThisMonth ?? 0} label="Bills this month" />
        <QuickStat icon={<Package className="h-4 w-4" />} value={data?.uniqueItems ?? 0} label="Items tracked" />
        <QuickStat icon={<Store className="h-4 w-4" />} value={data?.uniqueStores ?? 0} label="Stores visited" />
      </div>

      {/* Scan CTA */}
      <Link to="/scan" className="block">
        <div className="glass relative flex items-center gap-4 p-5 shimmer">
          <div className="pulse-ring h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
            <Camera className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Scan a new bill</p>
            <p className="text-xs text-muted-foreground">AI extracts every item in seconds</p>
          </div>
        </div>
      </Link>

      {/* Insights CTA */}
      <Link to={"/insights" as "/home"} className="block">
        <div className="glass flex items-center gap-4 p-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-sky-600 flex items-center justify-center">
            <Repeat className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Smart insights</p>
            <p className="text-xs text-muted-foreground">Repeat items, gap analysis, low-stock & price alerts</p>
          </div>
        </div>
      </Link>

      {/* Recent bills */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent bills</h2>
          <Link to="/history" className="text-xs text-violet-300">View all</Link>
        </div>
        {(data?.recent ?? []).length === 0 ? (
          <div className="glass p-6 text-center text-sm text-muted-foreground">No bills yet — scan your first one!</div>
        ) : (
          <div className="space-y-2">
            {data!.recent.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                className="glass flex items-center gap-3 p-3"
              >
                <CategoryIcon category={b.category} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{b.store}</p>
                  <p className="text-xs text-muted-foreground">{shortDate(b.bill_date)}</p>
                </div>
                <p className="tabular font-semibold">{money(b.total, b.currency ?? "INR")}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Insight */}
      <div className="glass p-4 flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-amber-300 mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          {data?.recent.length
            ? `You've logged ${data.billsThisMonth} bill${data.billsThisMonth === 1 ? "" : "s"} this month. Keep snapping to unlock smarter insights.`
            : "Scan a few bills to unlock spending insights tailored to your household."}
        </p>
      </div>
    </div>
  );
}

function QuickStat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="glass p-3 flex flex-col items-start gap-1">
      <div className="text-violet-300">{icon}</div>
      <p className="text-xl font-bold tabular">{value}</p>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}