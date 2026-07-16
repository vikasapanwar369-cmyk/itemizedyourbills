import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Flame, Snowflake, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { getInflation } from "@/lib/inflation.functions";
import { getCategory } from "@/lib/categories";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ItemDetailSheet } from "@/components/ItemDetailSheet";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/inflation")({
  head: () => ({ meta: [{ title: "Inflation — BillSnap" }] }),
  component: InflationPage,
});

function InflationPage() {
  const fetchInflation = useServerFn(getInflation);
  const { data, isLoading } = useQuery({
    queryKey: ["inflation"],
    queryFn: () => fetchInflation(),
  });
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [tab, setTab] = useState<"risers" | "fallers">("risers");

  const overallChart = useMemo(() => {
    if (!data) return [];
    return data.overall.series.map((s) => ({ label: s.label, value: s.avgUnitPrice ?? null }));
  }, [data]);

  return (
    <div className="px-5 pt-8 pb-32 space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">Your personal CPI</p>
        <h1 className="text-2xl font-bold">Inflation</h1>
        <p className="text-xs text-muted-foreground mt-1">
          How prices in your basket are moving — by category and by item.
        </p>
      </div>

      {isLoading && <SkeletonBlock />}

      {!isLoading && data && data.trackedItems === 0 && (
        <div className="glass p-6 text-center text-sm text-muted-foreground">
          Scan at least a couple of months of bills to see how your prices move.
        </div>
      )}

      {!isLoading && data && data.trackedItems > 0 && (
        <>
          {/* Overall */}
          <section className="glass-strong p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Basket price index · last 12 months</p>
                <p className="mt-1 text-3xl font-bold tabular">
                  {data.overall.changePct > 0 ? "+" : ""}
                  {data.overall.changePct.toFixed(1)}%
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {money(data.overall.firstAvg, data.currency, undefined, { precise: true })} →{" "}
                  {money(data.overall.lastAvg, data.currency, undefined, { precise: true })} avg unit price
                </p>
              </div>
              <MoMChip pct={data.overall.momPct} />
            </div>
            <div className="mt-4 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overallChart} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="basketFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.72 0.17 165)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="oklch(0.72 0.17 165)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "oklch(0.7 0 0)" }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={["auto", "auto"]} />
                  <Tooltip content={<ChartTip currency={data.currency} />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="oklch(0.72 0.17 165)"
                    strokeWidth={2}
                    fill="url(#basketFill)"
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* By category */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-violet-300" />
              <h2 className="text-base font-semibold">By category</h2>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3 -mt-1">
              Avg unit price per month · 12-month change
            </p>
            <div className="space-y-2">
              {data.categories.map((c) => (
                <CategoryRow key={c.category} c={c} currency={data.currency} />
              ))}
            </div>
          </section>

          {/* Item risers / fallers */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Flame className="h-4 w-4 text-rose-300" />
              <h2 className="text-base font-semibold">Items on the move</h2>
            </div>
            <div className="glass-strong p-1 grid grid-cols-2 gap-1 mb-3">
              <TabBtn active={tab === "risers"} onClick={() => setTab("risers")}>
                <TrendingUp className="h-3.5 w-3.5" /> Getting pricier
              </TabBtn>
              <TabBtn active={tab === "fallers"} onClick={() => setTab("fallers")}>
                <TrendingDown className="h-3.5 w-3.5" /> Getting cheaper
              </TabBtn>
            </div>

            <div className="space-y-2">
              {(tab === "risers" ? data.risers : data.fallers).map((i) => (
                <button
                  type="button"
                  key={i.key}
                  onClick={() => setOpenKey(i.key)}
                  className="glass p-3 w-full text-left active:scale-[0.99] transition"
                >
                  <div className="flex items-center gap-3">
                    <CategoryIcon category={i.category} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{i.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {i.brand} · {money(i.firstAvg, data.currency, undefined, { precise: true })} →{" "}
                        {money(i.lastAvg, data.currency, undefined, { precise: true })} / {i.unit}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold tabular ${i.changePct > 0 ? "text-rose-300" : "text-emerald-300"}`}>
                        {i.changePct > 0 ? "+" : ""}{i.changePct.toFixed(0)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">{i.dataPoints} mo</p>
                    </div>
                  </div>
                  <ItemSparkline series={i.series} up={i.changePct > 0} />
                </button>
              ))}
              {(tab === "risers" ? data.risers : data.fallers).length === 0 && (
                <div className="glass p-4 text-center text-xs text-muted-foreground">
                  Nothing here yet — need more months of data.
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <ItemDetailSheet itemKey={openKey} onClose={() => setOpenKey(null)} />
    </div>
  );
}

function CategoryRow({ c, currency }: { c: NonNullable<Awaited<ReturnType<typeof getInflation>>>["categories"][number]; currency: string }) {
  const meta = getCategory(c.category);
  const chartData = c.series.map((s) => ({ label: s.label, value: s.avgUnitPrice }));
  const up = c.changePct > 0;
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="glass p-3">
      <div className="flex items-center gap-3">
        <CategoryIcon category={c.category} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{meta.label}</p>
          <p className="text-[11px] text-muted-foreground">
            {money(c.firstAvg, currency, undefined, { precise: true })} →{" "}
            {money(c.lastAvg, currency, undefined, { precise: true })} avg
          </p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-semibold tabular ${up ? "text-rose-300" : c.changePct < 0 ? "text-emerald-300" : "text-muted-foreground"}`}>
            {c.changePct > 0 ? "+" : ""}{c.changePct.toFixed(1)}%
          </p>
          <MoMChip pct={c.momPct} small />
        </div>
      </div>
      <div className="mt-2 h-14">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
            <XAxis dataKey="label" hide />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip content={<ChartTip currency={currency} />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={up ? "oklch(0.68 0.22 15)" : "oklch(0.72 0.17 165)"}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

function ItemSparkline({ series, up }: { series: Array<{ label: string; avgUnitPrice: number | null }>; up: boolean }) {
  const data = series.map((s) => ({ label: s.label, value: s.avgUnitPrice }));
  return (
    <div className="mt-2 h-10 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={up ? "oklch(0.68 0.22 15)" : "oklch(0.72 0.17 165)"}
            strokeWidth={1.75}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTip({ active, payload, label, currency }: { active?: boolean; payload?: Array<{ value: number | null }>; label?: string; currency: string }) {
  if (!active || !payload || !payload.length || payload[0].value == null) return null;
  return (
    <div className="glass-strong px-2 py-1 text-[11px]">
      <div className="text-muted-foreground">{label}</div>
      <div className="tabular">{money(payload[0].value, currency, undefined, { precise: true })}</div>
    </div>
  );
}

function MoMChip({ pct, small }: { pct: number; small?: boolean }) {
  const up = pct > 0.5;
  const down = pct < -0.5;
  const cls = up ? "text-rose-300 bg-rose-500/10" : down ? "text-emerald-300 bg-emerald-500/10" : "text-muted-foreground bg-white/5";
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Snowflake;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${cls} px-2 py-0.5 border border-white/5 ${small ? "text-[10px]" : "text-[11px]"}`}>
      <Icon className="h-3 w-3" />
      {pct > 0 ? "+" : ""}{pct.toFixed(1)}% MoM
    </span>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition ${
        active ? "bg-white/10 text-foreground" : "text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SkeletonBlock() {
  return (
    <div className="space-y-3">
      <div className="glass h-40 animate-pulse" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass h-24 animate-pulse" />
      ))}
    </div>
  );
}