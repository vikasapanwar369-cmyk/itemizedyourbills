import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Database, Download, FileJson, FileSpreadsheet, ShieldCheck, ScrollText, Trash2, LogOut, LifeBuoy, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportAllData, deleteAllMyData } from "@/lib/export.functions";
import { getMyStaffRoles } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings & Backups — BillSnap" },
      { name: "description", content: "Export a full backup of your bills and items, manage your data, and read the BillSnap privacy policy and terms." },
      { property: "og:title", content: "Settings & Backups — BillSnap" },
      { property: "og:description", content: "Export backups, erase your data, and review privacy and terms." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function SettingsPage() {
  const qc = useQueryClient();
  const fetchExport = useServerFn(exportAllData);
  const wipe = useServerFn(deleteAllMyData);
  const fetchRoles = useServerFn(getMyStaffRoles);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: staff } = useQuery({ queryKey: ["staff-roles"], queryFn: () => fetchRoles() });

  const stamp = new Date().toISOString().slice(0, 10);

  async function backupJson() {
    setBusy("json");
    try {
      const payload = await fetchExport();
      download(`billsnap-backup-${stamp}.json`, JSON.stringify(payload, null, 2), "application/json");
      toast.success(`Backup ready — ${payload.counts.bills} bills, ${payload.counts.items} items`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  async function backupCsv(which: "items" | "bills") {
    setBusy(which);
    try {
      const payload = await fetchExport();
      const rows = (which === "items" ? payload.items : payload.bills) as Record<string, unknown>[];
      if (!rows.length) {
        toast.error(`No ${which} to export yet`);
        return;
      }
      download(`billsnap-${which}-${stamp}.csv`, toCsv(rows), "text/csv");
      toast.success(`${rows.length} ${which} exported`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  async function eraseEverything() {
    if (!confirm("Permanently delete ALL your bills, items, budgets, lists and recurring bills? This cannot be undone.")) return;
    if (!confirm("Last check — this is irreversible. Have you downloaded a backup?")) return;
    setBusy("wipe");
    try {
      await wipe();
      await qc.invalidateQueries();
      toast.success("All your data has been erased");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not erase data");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="px-5 pt-8 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Data & backups */}
      <section className="glass p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-violet-300" />
          <p className="font-semibold">Data &amp; backups</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Download everything you've ever scanned. JSON is a complete restorable backup; CSV opens in Excel or Google Sheets.
        </p>
        <div className="space-y-2">
          <ActionRow
            icon={<FileJson className="h-4 w-4" />}
            title="Full backup (JSON)"
            subtitle="Bills, items, budgets, lists, recurring bills"
            busy={busy === "json"}
            onClick={backupJson}
          />
          <ActionRow
            icon={<FileSpreadsheet className="h-4 w-4" />}
            title="Items export (CSV)"
            subtitle="Every line item with brand, qty and price"
            busy={busy === "items"}
            onClick={() => backupCsv("items")}
          />
          <ActionRow
            icon={<Download className="h-4 w-4" />}
            title="Bills export (CSV)"
            subtitle="One row per bill with store, date and total"
            busy={busy === "bills"}
            onClick={() => backupCsv("bills")}
          />
        </div>
      </section>

      {/* Legal */}
      <section className="glass p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          <p className="font-semibold">Legal</p>
        </div>
        <Link to="/privacy" className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm flex-1">Privacy Policy</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link to="/terms" className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
          <ScrollText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm flex-1">Terms of Service</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </section>

      {staff?.isStaff && (
        <Link to={"/admin" as "/home"} className="glass flex items-center gap-3 p-4">
          <LifeBuoy className="h-5 w-5 text-sky-300" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Support tools</p>
            <p className="text-[11px] text-muted-foreground">Platform stats and account lookup</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      {/* Danger zone */}
      <section className="glass p-5 space-y-3 border border-rose-500/20">
        <p className="font-semibold text-rose-300">Danger zone</p>
        <p className="text-xs text-muted-foreground">
          Erase every bill, item, budget, shopping list entry and recurring bill tied to your account. Your login stays active.
        </p>
        <button
          onClick={eraseEverything}
          disabled={busy === "wipe"}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500/15 px-4 py-2.5 text-sm font-semibold text-rose-300 disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" /> {busy === "wipe" ? "Erasing…" : "Delete all my data"}
        </button>
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </section>
    </div>
  );
}

function ActionRow({
  icon, title, subtitle, busy, onClick,
}: { icon: React.ReactNode; title: string; subtitle: string; busy: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 text-left transition hover:bg-white/[0.08] disabled:opacity-60"
    >
      <span className="text-violet-300">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-[11px] text-muted-foreground truncate">{subtitle}</span>
      </span>
      <span className="text-[11px] text-violet-300">{busy ? "Preparing…" : "Download"}</span>
    </button>
  );
}