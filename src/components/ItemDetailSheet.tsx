import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getItemDetail } from "@/lib/insights.functions";
import { money, fullDate, shortDate } from "@/lib/format";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Clock, Repeat, Store, TrendingUp, TrendingDown, Package, Tag, Calendar } from "lucide-react";

interface Props {
  itemKey: string | null;
  onClose: () => void;
}

export function ItemDetailSheet({ itemKey, onClose }: Props) {
  const fetchDetail = useServerFn(getItemDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["item-detail", itemKey],
    queryFn: () => fetchDetail({ data: { key: itemKey! } }),
    enabled: !!itemKey,
  });

  return (
    <Sheet open={!!itemKey} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto border-white/10 bg-background/95 backdrop-blur-xl">
        {isLoading || !data ? (
          <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-5 pb-10">
            <SheetHeader className="text-left p-0">
              <div className="flex items-start gap-3">
                <CategoryIcon category={data.category} size="md" />
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-xl font-bold leading-tight truncate">{data.name}</SheetTitle>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {data.brand}
                    {data.company && data.company !== data.brand ? ` · by ${data.company}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Pill>{data.sub}</Pill>
                    {data.unitWeightOrVolume && <Pill>{data.unitWeightOrVolume}</Pill>}
                  </div>
                </div>
              </div>
            </SheetHeader>

            {/* Top stats */}
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Total spent" value={money(data.totalSpent, data.currency)} />
              <Stat label="Times bought" value={`${data.count}×`} />
              <Stat label="Total qty" value={`${data.totalQty.toFixed(data.totalQty % 1 === 0 ? 0 : 2)} ${data.unit}`} />
            </div>

            {/* Cadence */}
            {data.avgGapDays > 0 && (
              <div className="glass p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Repeat className="h-4 w-4 text-violet-300" /> Buying pattern
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <Row icon={<Clock className="h-3.5 w-3.5" />} label="Avg gap" value={`~${data.avgGapDays} days`} />
                  <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Last bought" value={shortDate(data.lastDate)} />
                  {data.nextDueDate && (
                    <Row
                      icon={<Calendar className="h-3.5 w-3.5" />}
                      label="Next predicted"
                      value={`${shortDate(data.nextDueDate)}${
                        data.daysUntilDue !== null
                          ? ` (${data.daysUntilDue < 0 ? `${-data.daysUntilDue}d overdue` : `in ${data.daysUntilDue}d`})`
                          : ""
                      }`}
                    />
                  )}
                  <Row icon={<Calendar className="h-3.5 w-3.5" />} label="First seen" value={shortDate(data.firstDate)} />
                </div>
              </div>
            )}

            {/* Price */}
            <div className="glass p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Tag className="h-4 w-4 text-emerald-300" /> Price per {data.unit}
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <Row label="Lowest" value={money(data.minUnitPrice, data.currency, undefined, { precise: true })} />
                <Row label="Average" value={money(data.avgUnitPrice, data.currency, undefined, { precise: true })} />
                <Row label="Highest" value={money(data.maxUnitPrice, data.currency, undefined, { precise: true })} />
              </div>
              {Math.abs(data.priceDeltaPct) >= 1 && (
                <div className={`flex items-center gap-1.5 text-xs ${data.priceDeltaPct > 0 ? "text-rose-300" : "text-emerald-300"}`}>
                  {data.priceDeltaPct > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {data.priceDeltaPct > 0 ? "+" : ""}
                  {data.priceDeltaPct.toFixed(1)}% since first purchase
                </div>
              )}
            </div>

            {/* Stores */}
            {data.stores.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Store className="h-4 w-4 text-sky-300" /> Where you buy it
                </div>
                <div className="glass divide-y divide-white/5">
                  {data.stores.map((s, idx) => (
                    <div key={s.store} className="p-3 flex items-center justify-between text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {s.store}
                          {idx === 0 && data.stores.length > 1 && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">cheapest</span>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {s.times}× · spent {money(s.totalSpent, s.currency)}
                        </p>
                      </div>
                      <p className="tabular text-sm">{money(s.avgUnitPrice, s.currency, undefined, { precise: true })}<span className="text-[10px] text-muted-foreground">/{data.unit}</span></p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Package className="h-4 w-4 text-amber-300" /> Every purchase
              </div>
              <div className="glass divide-y divide-white/5">
                {data.occurrences.map((o) => (
                  <div key={o.itemId} className="p-3 flex items-start gap-3 text-sm">
                    <div className="text-center w-12 shrink-0">
                      <p className="text-[10px] text-muted-foreground uppercase">{new Date(o.date).toLocaleDateString("en-IN", { month: "short" })}</p>
                      <p className="text-lg font-bold leading-none">{new Date(o.date).getDate()}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(o.date).getFullYear()}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{o.store}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {o.qty} {o.unit} @ {money(o.unitPrice, o.currency, undefined, { precise: true })}
                        {o.mrp ? ` · MRP ${money(o.mrp, o.currency)}` : ""}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{fullDate(o.date)}{o.paymentMode && o.paymentMode !== "unknown" ? ` · ${o.paymentMode}` : ""}</p>
                    </div>
                    <p className="tabular font-semibold">{money(o.price, o.currency)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass p-3 text-center">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-bold mt-0.5 tabular">{value}</p>
    </div>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className="font-medium tabular">{value}</p>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">{children}</span>;
}