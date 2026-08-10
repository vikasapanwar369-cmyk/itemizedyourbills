import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ArrowLeft, Bell, BellOff, Target, Repeat, PackageCheck, TrendingUp, X, Mail } from "lucide-react";
import { toast } from "sonner";
import { money, shortDate } from "@/lib/format";
import {
  getAlerts, dismissAlert, clearDismissedAlerts, updateNotificationSettings,
  type Alert, type NotificationSettings,
} from "@/lib/notifications.functions";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Alerts — BillSnap" },
      { name: "description", content: "Budget warnings, recurring bill reminders, refill nudges and price-change alerts from your own purchase history." },
      { property: "og:title", content: "Alerts — BillSnap" },
      { property: "og:description", content: "Budget, refill and recurring bill alerts built from your bills." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

const KIND_META: Record<Alert["kind"], { icon: typeof Bell; label: string; tone: string }> = {
  budget:    { icon: Target,       label: "Budget",    tone: "text-rose-300 bg-rose-500/15" },
  recurring: { icon: Repeat,       label: "Bill due",  tone: "text-amber-300 bg-amber-500/15" },
  refill:    { icon: PackageCheck, label: "Refill",    tone: "text-emerald-300 bg-emerald-500/15" },
  price:     { icon: TrendingUp,   label: "Price",     tone: "text-violet-300 bg-violet-500/15" },
};

const TOGGLES: Array<{ key: keyof NotificationSettings; label: string; hint: string }> = [
  { key: "budget_alerts",    label: "Budget alerts",         hint: "When a category nears or passes its monthly limit" },
  { key: "recurring_alerts", label: "Recurring bill due",    hint: "Reminders before a repeating bill is expected" },
  { key: "refill_alerts",    label: "Refill reminders",      hint: "When an item you buy regularly is about to run out" },
  { key: "price_alerts",     label: "Price change alerts",   hint: "When an item's unit price moves by 20% or more" },
  { key: "email_enabled",    label: "Email me these alerts", hint: "Needs a verified sender domain before emails go out" },
];

function NotificationsPage() {
  const fetchAlerts = useServerFn(getAlerts);
  const dismiss = useServerFn(dismissAlert);
  const clearAll = useServerFn(clearDismissedAlerts);
  const saveSettings = useServerFn(updateNotificationSettings);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["alerts"], queryFn: () => fetchAlerts() });

  const dismissM = useMutation({
    mutationFn: (key: string) => dismiss({ data: { key } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const restoreM = useMutation({
    mutationFn: () => clearAll(),
    onSuccess: () => { toast.success("Dismissed alerts restored"); qc.invalidateQueries({ queryKey: ["alerts"] }); },
  });
  const settingsM = useMutation({
    mutationFn: (patch: Partial<NotificationSettings>) => saveSettings({ data: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const alerts = data?.alerts ?? [];
  const settings = data?.settings;

  return (
    <div className="px-5 pt-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link to={"/home" as "/home"} aria-label="Back" className="glass h-9 w-9 flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-xs text-muted-foreground">
            {isLoading ? "Checking your data…" : `${alerts.length} active · ${data?.counts.high ?? 0} urgent`}
          </p>
        </div>
        <button onClick={() => restoreM.mutate()} className="glass px-3 py-2 text-[11px] text-muted-foreground">
          Restore dismissed
        </button>
      </div>

      {!isLoading && alerts.length === 0 && (
        <EmptyState
          icon={BellOff}
          title="Nothing needs your attention"
          description="Budgets are on track, no repeating bills are due and nothing is about to run out."
        />
      )}

      <div className="space-y-3">
        {alerts.map((a, i) => {
          const meta = KIND_META[a.kind];
          const Icon = meta.icon;
          return (
            <motion.div
              key={a.key}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className={`glass p-4 flex gap-3 ${a.severity === "high" ? "ring-1 ring-rose-500/30" : ""}`}
            >
              <div className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${meta.tone}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate">{a.title}</p>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{meta.label}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{a.body}</p>
                <div className="mt-2 flex items-center gap-3 text-[11px]">
                  {a.amount !== null && (
                    <span className="tabular font-medium">{money(a.amount, a.currency)}</span>
                  )}
                  {a.when && <span className="text-muted-foreground">{shortDate(a.when)}</span>}
                  {a.to && (
                    <Link to={a.to as "/home"} className="text-violet-300 font-medium">Open</Link>
                  )}
                </div>
              </div>
              <button
                aria-label="Dismiss"
                onClick={() => dismissM.mutate(a.key)}
                className="h-7 w-7 shrink-0 rounded-lg bg-white/[0.05] flex items-center justify-center text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </div>

      <section className="glass p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-violet-300" />
          <p className="font-semibold">What you get notified about</p>
        </div>
        {TOGGLES.map((t) => {
          const on = settings ? Boolean(settings[t.key]) : false;
          return (
            <button
              key={t.key}
              onClick={() => settingsM.mutate({ [t.key]: !on })}
              className="w-full flex items-center gap-3 text-left"
            >
              <div className="flex-1">
                <p className="text-sm">{t.label}</p>
                <p className="text-[11px] text-muted-foreground">{t.hint}</p>
              </div>
              <span className={`h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-emerald-500/70" : "bg-white/10"}`}>
                <span className={`block h-5 w-5 mt-0.5 rounded-full bg-white transition-transform ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
              </span>
            </button>
          );
        })}
        {settings?.email_enabled && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-[11px] text-amber-200">
            <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Email delivery is queued but needs a verified sender domain for your app before messages can be sent.
          </p>
        )}
      </section>
    </div>
  );
}
