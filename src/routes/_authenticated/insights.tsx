import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Clock, Repeat, ShoppingCart, Store, TrendingDown, TrendingUp } from "lucide-react";
import { getInsights } from "@/lib/insights.functions";
import { money, shortDate } from "@/lib/format";
import { ItemDetailSheet } from "@/components/ItemDetailSheet";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [{ title: "Insights — BillSnap" }] }),
  component: InsightsPage,
});

function InsightsPage() {
  const fetchInsights = useServerFn(getInsights);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["insights"],
    queryFn: () => fetchInsights(),
  });

  return (
    <div className="px-5 pt-8 pb-32 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Smart household</p>
          <h1 className="text-2xl font-bold">Insights</h1>
          <p className="text-xs text-muted-foreground mt-1">
            AI tracks what repeats, how often, and where it's cheapest.
          </p>
        </div>
        <button onClick={() => refetch()} className="glass text-xs px-3 py-2 font-medium">
          {isRefetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {isLoading && <SkeletonBlock />}

      {!isLoading && data && (
        <>
          {data.totalItemsTracked === 0 && (
            <div className="glass p-6 text-center text-sm text-muted-foreground">
              Scan at least 2 bills with overlapping items to unlock repeat-purchase insights.
            </div>
          )}

          {/* Running low */}
          {data.lowStock.length > 0 && (
            <Section title="Running low" icon={<AlertTriangle className="h-4 w-4 text-amber-300" />} subtitle="Predicted to run out based on your buying pattern">
              <div className="space-y-2">
                {data.lowStock.slice(0, 8).map((i) => (
                  <motion.button type="button" onClick={() => setOpenKey(i.key)} key={i.key} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="glass p-3 flex items-center gap-3 w-full text-left active:scale-[0.99] transition">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold ${
                      (i.daysUntilDue ?? 0) < 0 ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"
                    }`}>
                      {i.daysUntilDue !== null ? (i.daysUntilDue < 0 ? `${-i.daysUntilDue}d` : `${i.daysUntilDue}d`) : "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-sm">{i.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Every ~{i.avgGapDays}d · last {shortDate(i.lastDate)}
                        {(i.daysUntilDue ?? 0) < 0 ? " · overdue" : ""}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground tabular">{money(i.lastUnitPrice, i.currency)}</p>
                  </motion.button>
                ))}
              </div>
            </Section>
          )}

          {/* Shopping list */}
          {data.shoppingList.length > 0 && (
            <Section title="Suggested shopping list" icon={<ShoppingCart className="h-4 w-4 text-emerald-300" />} subtitle="Reorder these soon">
              <div className="glass p-4 space-y-2">
                {data.shoppingList.slice(0, 10).map((s) => (
                  <div key={s.key} className="flex items-center gap-3 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-emerald-400" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate">
                        <span className="font-medium">{s.qty} × {s.name}</span>
                        {s.brand && s.brand !== "Local" ? <span className="text-muted-foreground"> · {s.brand}</span> : null}
                      </p>
                      {s.cheapestStore && (
                        <p className="text-[11px] text-muted-foreground">Cheapest at {s.cheapestStore}</p>
                      )}
                    </div>
                    <p className="tabular text-xs text-muted-foreground">≈ {money(s.estimatedCost, s.currency)}</p>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const txt = data.shoppingList
                      .map((s) => `• ${s.qty} × ${s.name}${s.cheapestStore ? ` (${s.cheapestStore})` : ""}`)
                      .join("\n");
                    navigator.clipboard?.writeText(txt);
                  }}
                  className="mt-2 w-full text-xs font-medium glass-strong py-2"
                >
                  Copy list
                </button>
              </div>
            </Section>
          )}

          {/* Repeats */}
          {data.repeats.length > 0 && (
            <Section title="What repeats in your home" icon={<Repeat className="h-4 w-4 text-violet-300" />} subtitle={`${data.totalItemsTracked} items tracked across your bills`}>
              <div className="space-y-2">
                {data.repeats.slice(0, 12).map((i) => (
                  <button type="button" onClick={() => setOpenKey(i.key)} key={i.key} className="glass p-3 w-full text-left active:scale-[0.99] transition">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{i.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {i.sub} · {i.brand}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular">{i.count}×</p>
                        <p className="text-[10px] text-muted-foreground">{money(i.totalSpent, i.currency)}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <Chip icon={<Clock className="h-3 w-3" />}>every ~{i.avgGapDays}d</Chip>
                      <Chip>last {shortDate(i.lastDate)}</Chip>
                      {i.nextDueDate && <Chip>next ~{shortDate(i.nextDueDate)}</Chip>}
                      {i.cheapestStore && <Chip icon={<Store className="h-3 w-3" />}>cheap: {i.cheapestStore}</Chip>}
                      {Math.abs(i.priceDeltaPct) >= 5 && (
                        <Chip
                          icon={i.priceDeltaPct > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          className={i.priceDeltaPct > 0 ? "text-rose-300" : "text-emerald-300"}
                        >
                          {i.priceDeltaPct > 0 ? "+" : ""}{i.priceDeltaPct.toFixed(0)}%
                        </Chip>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Price drift */}
          {data.priceAlerts.length > 0 && (
            <Section title="Price changes" icon={<ArrowUpRight className="h-4 w-4 text-rose-300" />} subtitle="Items where unit price moved >15%">
              <div className="space-y-2">
                {data.priceAlerts.slice(0, 8).map((i) => (
                  <button type="button" onClick={() => setOpenKey(i.key)} key={i.key} className="glass p-3 flex items-center gap-3 w-full text-left active:scale-[0.99] transition">
                    {i.priceDeltaPct > 0 ? (
                      <ArrowUpRight className="h-4 w-4 text-rose-300 shrink-0" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-emerald-300 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-sm">{i.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {money(i.firstUnitPrice, i.currency)} → {money(i.lastUnitPrice, i.currency)}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold tabular ${i.priceDeltaPct > 0 ? "text-rose-300" : "text-emerald-300"}`}>
                      {i.priceDeltaPct > 0 ? "+" : ""}{i.priceDeltaPct.toFixed(0)}%
                    </p>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Store comparison */}
          {data.storeCompare.length > 0 && (
            <Section title="Where it's cheapest" icon={<Store className="h-4 w-4 text-sky-300" />} subtitle="Same item, different stores">
              <div className="space-y-2">
                {data.storeCompare.slice(0, 8).map((i) => {
                  const cheapest = i.stores[0];
                  const priciest = i.stores[i.stores.length - 1];
                  const save = priciest.avgUnitPrice - cheapest.avgUnitPrice;
                  return (
                    <button type="button" onClick={() => setOpenKey(i.key)} key={i.key} className="glass p-3 w-full text-left active:scale-[0.99] transition">
                      <p className="text-sm font-medium truncate">{i.name}</p>
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className="text-emerald-300">{cheapest.store} · {money(cheapest.avgUnitPrice, cheapest.currency, undefined, { precise: true })}</span>
                        <span className="text-muted-foreground">vs</span>
                        <span className="text-rose-300">{priciest.store} · {money(priciest.avgUnitPrice, priciest.currency, undefined, { precise: true })}</span>
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Save {money(save, cheapest.currency, undefined, { precise: true })} per {i.unit}
                      </p>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}

          {data.totalItemsTracked > 0 &&
            data.lowStock.length === 0 &&
            data.priceAlerts.length === 0 &&
            data.storeCompare.length === 0 && (
              <div className="glass p-4 text-center text-sm text-muted-foreground">
                Nothing urgent. Your spending is steady — keep scanning to catch more patterns.
              </div>
            )}

          <Link to={"/scan" as "/home"} className="block">
            <div className="glass-strong p-4 text-center text-sm font-medium">+ Scan another bill</div>
          </Link>
        </>
      )}

      <ItemDetailSheet itemKey={openKey} onClose={() => setOpenKey(null)} />
    </div>
  );
}

function Section({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {subtitle && <p className="text-[11px] text-muted-foreground mb-3 -mt-1">{subtitle}</p>}
      {children}
    </section>
  );
}

function Chip({ icon, children, className = "" }: { icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-muted-foreground ${className}`}>
      {icon}
      {children}
    </span>
  );
}

function SkeletonBlock() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass h-20 animate-pulse" />
      ))}
    </div>
  );
}