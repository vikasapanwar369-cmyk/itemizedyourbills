import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock, Repeat, Store as StoreIcon, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getRecurringBills,
  upsertRecurringBill,
  deleteRecurringBill,
  type RecurringRow,
} from "@/lib/recurring.functions";
import { money, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/recurring")({
  head: () => ({ meta: [{ title: "Recurring bills — BillSnap" }] }),
  component: RecurringPage,
});

const CADENCE_PRESETS: { label: string; days: number }[] = [
  { label: "Weekly", days: 7 },
  { label: "Fortnightly", days: 14 },
  { label: "Monthly", days: 30 },
  { label: "Bi-monthly", days: 60 },
  { label: "Quarterly", days: 90 },
];

function RecurringPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(getRecurringBills);
  const upsertFn = useServerFn(upsertRecurringBill);
  const deleteFn = useServerFn(deleteRecurringBill);

  const { data, isLoading } = useQuery({ queryKey: ["recurring"], queryFn: () => fetchList() });

  const upsert = useMutation({
    mutationFn: (r: RecurringRow & { status: RecurringRow["status"] }) =>
      upsertFn({
        data: {
          key: r.key,
          store: r.store,
          category: r.category,
          cadenceDays: r.cadenceDays,
          avgAmount: r.avgAmount,
          currency: r.currency,
          status: r.status,
          lastSeenDate: r.lastSeenDate,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring"] });
      qc.invalidateQueries({ queryKey: ["insights"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const remove = useMutation({
    mutationFn: (key: string) => deleteFn({ data: { key } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] }),
  });

  const rows = data ?? [];
  const pending = rows.filter((r) => r.status === "pending" && r.detected);
  const confirmed = rows.filter((r) => r.status === "confirmed");
  const disabled = rows.filter((r) => r.status === "disabled");

  return (
    <div className="px-5 pt-8 pb-32 space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">Subscriptions & bills</p>
        <h1 className="text-2xl font-bold">Recurring bills</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Confirm what repeats, tune the cadence, or silence false matches.
        </p>
      </div>

      {isLoading && <div className="glass p-6 text-center text-sm text-muted-foreground">Loading…</div>}

      {!isLoading && rows.length === 0 && (
        <div className="glass p-6 text-center text-sm text-muted-foreground">
          Nothing recurring yet. Scan a few bills from the same store and we'll spot the pattern.
        </div>
      )}

      {pending.length > 0 && (
        <Section title="Needs review" subtitle="Detected from your history — confirm or dismiss.">
          {pending.map((r) => (
            <RecurringCard
              key={r.key}
              row={r}
              onSave={(next) => upsert.mutate({ ...r, ...next })}
              onDisable={() => upsert.mutate({ ...r, status: "disabled" })}
              onConfirm={(cadence) => upsert.mutate({ ...r, cadenceDays: cadence, status: "confirmed" })}
            />
          ))}
        </Section>
      )}

      {confirmed.length > 0 && (
        <Section title="Active" subtitle="Being tracked in insights & home reminders.">
          {confirmed.map((r) => (
            <RecurringCard
              key={r.key}
              row={r}
              onSave={(next) => upsert.mutate({ ...r, ...next })}
              onDisable={() => upsert.mutate({ ...r, status: "disabled" })}
            />
          ))}
        </Section>
      )}

      {disabled.length > 0 && (
        <Section title="Ignored" subtitle="Won't show reminders. Restore or delete anytime.">
          {disabled.map((r) => (
            <div key={r.key} className="glass p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{r.store}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{r.category}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => upsert.mutate({ ...r, status: "confirmed" })}
                  className="glass text-xs px-3 py-1.5 font-medium"
                >
                  Restore
                </button>
                <button
                  onClick={() => remove.mutate(r.key)}
                  className="text-xs px-3 py-1.5 font-medium text-rose-300/80 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
        {subtitle && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{subtitle}</p>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RecurringCard({
  row,
  onSave,
  onConfirm,
  onDisable,
}: {
  row: RecurringRow;
  onSave: (patch: { cadenceDays: number; status: RecurringRow["status"] }) => void;
  onConfirm?: (cadenceDays: number) => void;
  onDisable: () => void;
}) {
  const [cadence, setCadence] = useState(row.cadenceDays);
  const dirty = cadence !== row.cadenceDays;
  const dueLabel =
    row.daysUntilDue == null
      ? "—"
      : row.daysUntilDue < 0
        ? `${-row.daysUntilDue}d overdue`
        : row.daysUntilDue === 0
          ? "Due today"
          : `in ${row.daysUntilDue}d`;
  const dueTone =
    row.daysUntilDue == null
      ? "text-muted-foreground"
      : row.daysUntilDue < 0
        ? "text-rose-300"
        : row.daysUntilDue <= 3
          ? "text-amber-300"
          : "text-emerald-300";

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="glass-strong p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StoreIcon className="h-4 w-4 text-violet-300 shrink-0" />
            <p className="font-semibold truncate">{row.store}</p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 capitalize">
            {row.category} · {row.count} bills · last {row.lastSeenDate ? shortDate(row.lastSeenDate) : "—"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold tabular">{money(row.avgAmount, row.currency)}</p>
          <p className={`text-[11px] font-medium ${dueTone}`}>{dueLabel}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Repeat className="h-3 w-3" /> Cadence
          </span>
          <span className="text-xs tabular font-medium">{cadence}d</span>
        </div>
        <input
          type="range"
          min={1}
          max={120}
          value={cadence}
          onChange={(e) => setCadence(Number(e.target.value))}
          className="w-full accent-violet-500"
        />
        <div className="flex flex-wrap gap-1.5">
          {CADENCE_PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => setCadence(p.days)}
              className={`text-[10px] px-2 py-1 rounded-full border transition ${
                cadence === p.days
                  ? "bg-violet-500/25 border-violet-400/60 text-violet-100"
                  : "border-white/10 text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        {row.status !== "confirmed" ? (
          <button
            onClick={() => (onConfirm ? onConfirm(cadence) : onSave({ cadenceDays: cadence, status: "confirmed" }))}
            className="flex-1 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white text-xs font-semibold flex items-center justify-center gap-1"
          >
            <CheckCircle2 className="h-4 w-4" /> Confirm
          </button>
        ) : (
          <button
            onClick={() => onSave({ cadenceDays: cadence, status: "confirmed" })}
            disabled={!dirty}
            className="flex-1 py-2 rounded-xl glass text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {dirty ? "Save changes" : "Saved"}
          </button>
        )}
        <button
          onClick={onDisable}
          className="py-2 px-3 rounded-xl glass text-xs font-medium text-rose-300/90 hover:text-rose-300 flex items-center gap-1"
          title="Not a subscription"
        >
          <XCircle className="h-4 w-4" /> Not recurring
        </button>
      </div>

      {row.confidence && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Detection confidence: <span className="capitalize">{row.confidence}</span>
        </div>
      )}
    </motion.div>
  );
}
