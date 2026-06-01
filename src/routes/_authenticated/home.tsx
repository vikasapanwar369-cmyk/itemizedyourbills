import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Camera, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CountUp } from "@/components/CountUp";
import { CategoryIcon } from "@/components/CategoryIcon";
import { money, shortDate } from "@/lib/format";

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
      const [{ data: thisMonth }, { data: lastMonth }, { data: recent }] = await Promise.all([
        supabase.from("bills").select("total, bill_date, currency").gte("bill_date", monthStart),
        supabase.from("bills").select("total, currency").gte("bill_date", lastMonthStart).lt("bill_date", monthStart),
        supabase.from("bills").select("id, store, bill_date, category, total, currency").order("bill_date", { ascending: false }).limit(5),
      ]);
      const thisTotal = (thisMonth ?? []).reduce((s, b) => s + Number(b.total), 0);
      const lastTotal = (lastMonth ?? []).reduce((s, b) => s + Number(b.total), 0);
      const cc = new Map<string, number>();
      for (const b of [...(thisMonth ?? []), ...(recent ?? [])]) cc.set(b.currency ?? "INR", (cc.get(b.currency ?? "INR") ?? 0) + 1);
      const currency = [...cc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "INR";
      return { thisTotal, lastTotal, thisMonth: thisMonth ?? [], recent: recent ?? [], currency };
    },
  });

  const thisTotal = data?.thisTotal ?? 0;
  const lastTotal = data?.lastTotal ?? 0;
  const currency = data?.currency ?? "INR";
  const delta = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : 0;
  const up = delta > 0;

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="px-5 pt-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</p>
          <h1 className="text-2xl font-bold mt-0.5">{greet} 👋</h1>
        </div>
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
      </motion.div>

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
            ? `You've logged ${data.thisMonth.length} bill${data.thisMonth.length === 1 ? "" : "s"} this month. Keep snapping to unlock smarter insights.`
            : "Scan a few bills to unlock spending insights tailored to your household."}
        </p>
      </div>
    </div>
  );
}