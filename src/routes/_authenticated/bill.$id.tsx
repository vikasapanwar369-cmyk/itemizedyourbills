import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ChevronLeft, Receipt, CreditCard, Hash, MapPin, Clock, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CategoryIcon } from "@/components/CategoryIcon";
import { money, fullDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/bill/$id")({
  head: () => ({ meta: [{ title: "Bill Detail — BillSnap" }] }),
  component: BillDetailPage,
});

function BillDetailPage() {
  const { id } = Route.useParams();

  const { data: bill } = useQuery({
    queryKey: ["bill", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("bills")
        .select("id, store, bill_date, category, total, currency, payment_mode, bill_number, bill_time, merchant_address, discount, tax, subtotal")
        .eq("id", id)
        .single();
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["bill-items", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("items")
        .select("id, name, brand, qty, unit, unit_price, price, category, sub, bill_date")
        .eq("bill_id", id)
        .order("name", { ascending: true });
      return data ?? [];
    },
  });

  const currency = bill?.currency ?? "INR";

  if (!bill) {
    return (
      <div className="px-5 pt-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/home" className="glass h-10 w-10 flex items-center justify-center" aria-label="Back">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-bold">Bill Detail</h1>
        </div>
        <div className="glass p-6 text-center text-sm text-muted-foreground">Loading bill…</div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-8 pb-32 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/home" className="glass h-10 w-10 flex items-center justify-center" aria-label="Back">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold">Bill Detail</h1>
      </div>

      {/* Bill header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong relative overflow-hidden p-5"
      >
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="flex items-start gap-3">
          <CategoryIcon category={bill.category} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold truncate">{bill.store}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {fullDate(bill.bill_date)}
              </span>
              {bill.bill_time && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {bill.bill_time}
                </span>
              )}
              {bill.bill_number && (
                <span className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  {bill.bill_number}
                </span>
              )}
            </div>
            {bill.merchant_address && (
              <p className="mt-1 text-xs text-muted-foreground flex items-start gap-1">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                <span className="truncate">{bill.merchant_address}</span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="text-3xl font-bold tabular mt-0.5">{money(bill.total, currency)}</p>
          </div>
          <div className="space-y-2">
            {Number(bill.subtotal) > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular">{money(bill.subtotal, currency)}</span>
              </div>
            )}
            {Number(bill.tax) > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Tax</span>
                <span className="tabular">{money(bill.tax, currency)}</span>
              </div>
            )}
            {Number(bill.discount) > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Discount</span>
                <span className="tabular text-emerald-300">-{money(bill.discount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <CreditCard className="h-3 w-3" />
                Payment
              </span>
              <span className="capitalize">{bill.payment_mode}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Items */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="h-4 w-4 text-violet-300" />
          <h2 className="font-semibold">{items.length} item{items.length === 1 ? "" : "s"}</h2>
        </div>

        {items.length === 0 ? (
          <div className="glass p-6 text-center text-sm text-muted-foreground">No items found for this bill.</div>
        ) : (
          <div className="space-y-2">
            {items.map((it, i) => (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.4) }}
                className="glass p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{it.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {it.brand !== "Local" ? `${it.brand}` : "Local brand"}
                      {it.sub && it.sub !== "Other" ? ` · ${it.sub}` : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground tabular mt-0.5">
                      {Number(it.qty)} {it.unit}
                      {Number(it.unit_price) > 0 ? ` · ${money(Number(it.unit_price), currency, undefined, { precise: true })}/${it.unit}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="tabular font-semibold text-sm">{money(Number(it.price), currency)}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
