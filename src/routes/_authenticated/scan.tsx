import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Upload, CheckCircle2, AlertCircle, Trash2, Plus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { scanBill, checkDuplicateBill, type ScannedBill } from "@/lib/bills.functions";
import { supabase } from "@/integrations/supabase/client";
import { computeImagePhash, computeContentHash } from "@/lib/imageHash";
import { shortDate, money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [{ title: "Scan bill — BillSnap" }] }),
  component: ScanPage,
});

type Phase = "idle" | "reading" | "review" | "saving" | "dup" | "done";
type DupBill = { id: string; store: string; bill_date: string; total: number; currency: string };

function ScanPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<string>("");
  const [preview, setPreview] = useState<string | null>(null);
  const runScan = useServerFn(scanBill);
  const runDupCheck = useServerFn(checkDuplicateBill);

  const [dup, setDup] = useState<DupBill | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingBill, setPendingBill] = useState<ScannedBill | null>(null);
  const [pendingPhash, setPendingPhash] = useState<string>("");
  const [draft, setDraft] = useState<ScannedBill | null>(null);

  async function onFile(file: File) {
    setPreview(URL.createObjectURL(file));
    setPhase("reading");
    setProgress("Checking against your past bills…");
    try {
      const phash = await computeImagePhash(file);
      if (phash) {
        const pre = await runDupCheck({ data: { imagePhash: phash } });
        if (pre.found) {
          setDup(pre.found);
          setPendingFile(file);
          setPendingBill(null);
          setPendingPhash(phash);
          setPhase("dup");
          return;
        }
      }

      setProgress("Reading your bill…");
      const base64 = await fileToBase64(file);
      const bill = await runScan({ data: { imageBase64: base64, mimeType: file.type || "image/jpeg" } });

      const contentHash = await computeContentHash({
        store: bill.store,
        date: bill.date ?? new Date().toISOString(),
        total: Number(bill.total) || bill.items.reduce((s, it) => s + Number(it.price || 0), 0),
        items: bill.items.map((it) => it.name),
      });
      const post = await runDupCheck({ data: { imagePhash: phash, contentHash } });
      if (post.found) {
        setDup(post.found);
        setPendingFile(file);
        setPendingBill(bill);
        setPendingPhash(phash);
        setPhase("dup");
        return;
      }

      setPendingFile(file);
      setPendingPhash(phash);
      setDraft(bill);
      setPhase("review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
      setPhase("idle");
      setPreview(null);
    }
  }

  async function persistBill(file: File, bill: ScannedBill, imagePhash: string, contentHash: string) {
    setPhase("saving");
    setProgress("Saving to your account…");

      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");

      let imageUrl: string | null = null;
      const path = `${uid}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("bill-images").upload(path, file, { upsert: false });
      if (!upErr) imageUrl = path;

      const billDate = bill.date ? new Date(bill.date) : new Date();
      const computedTotal = bill.items.reduce((s, it) => s + Number(it.price || 0), 0) || bill.total;

      const { data: inserted, error } = await supabase.from("bills").insert({
        user_id: uid,
        store: bill.store || "Unknown",
        bill_date: isNaN(billDate.getTime()) ? new Date().toISOString() : billDate.toISOString(),
        bill_time: bill.time ?? null,
        bill_number: bill.bill_number ?? null,
        merchant_address: bill.merchant_address ?? null,
        category: bill.category,
        total: computedTotal,
        subtotal: bill.subtotal || 0,
        tax: bill.tax || 0,
        discount: bill.discount || 0,
        currency: bill.currency || "INR",
        country: bill.country || "IN",
        locale: bill.locale || "en-IN",
        payment_mode: bill.payment_mode || "unknown",
        image_url: imageUrl,
        image_phash: imagePhash || null,
        content_hash: contentHash || null,
      }).select("id").single();
      if (error) throw error;

      const itemsPayload = bill.items.map((it) => ({
        bill_id: inserted!.id,
        user_id: uid,
        name: it.name,
        canonical_name: it.canonical_name || it.name.toLowerCase().trim(),
        brand: it.brand || "Local",
        company: it.company ?? null,
        qty: Number(it.qty) || 1,
        unit: it.unit || "pcs",
        unit_weight_or_volume: it.unit_weight_or_volume ?? null,
        mrp: it.mrp ?? null,
        unit_price: Number(it.unitPrice) || 0,
        price: Number(it.price) || 0,
        discount: Number(it.discount) || 0,
        gst_percent: it.gst_percent ?? null,
        sub: it.sub || "Other",
        category: it.category || bill.category,
        category_id: it.category_id,
        subcategory_id: it.subcategory_id,
        category_confidence: it.confidence,
        categorized_by: "ai",
        bill_date: isNaN(billDate.getTime()) ? new Date().toISOString() : billDate.toISOString(),
      }));
      const { error: itemsErr } = await supabase.from("items").insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      setPhase("done");
      setProgress(`Saved! ${bill.items.length} items added to your ${prettyCat(bill.category)} list`);
      qc.invalidateQueries();
      toast.success(`Saved · ${bill.items.length} items categorized`);
      setTimeout(() => navigate({ to: "/home" }), 1100);
  }

  async function onConfirmDraft() {
    if (!pendingFile || !draft) return;
    try {
      const contentHash = await computeContentHash({
        store: draft.store,
        date: draft.date ?? new Date().toISOString(),
        total: Number(draft.total) || draft.items.reduce((s, it) => s + Number(it.price || 0), 0),
        items: draft.items.map((it) => it.name),
      });
      await persistBill(pendingFile, draft, pendingPhash, contentHash);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function onSaveAnyway() {
    if (!pendingFile || !pendingPhash) return;
    try {
      let bill = pendingBill;
      if (!bill) {
        setPhase("reading");
        setProgress("Reading your bill…");
        const base64 = await fileToBase64(pendingFile);
        bill = await runScan({ data: { imageBase64: base64, mimeType: pendingFile.type || "image/jpeg" } });
      }
      setDraft(bill);
      setDup(null);
      setPhase("review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
      setPhase("idle");
      setPreview(null);
    }
  }

  function onViewOriginal() {
    qc.invalidateQueries();
    navigate({ to: "/history" });
  }

  function onCancelDup() {
    setDup(null);
    setPendingFile(null);
    setPendingBill(null);
    setPendingPhash("");
    setPreview(null);
    setPhase("idle");
  }

  function updateItem(idx: number, patch: Partial<ScannedBill["items"][number]>) {
    if (!draft) return;
    const items = draft.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    setDraft({ ...draft, items, total: items.reduce((s, it) => s + Number(it.price || 0), 0) });
  }
  function removeItem(idx: number) {
    if (!draft) return;
    const items = draft.items.filter((_, i) => i !== idx);
    setDraft({ ...draft, items, total: items.reduce((s, it) => s + Number(it.price || 0), 0) });
  }
  function addItem() {
    if (!draft) return;
    const blank: ScannedBill["items"][number] = {
      name: "New item", canonical_name: "new item", brand: "Local", company: null,
      qty: 1, unit: "pcs", unit_weight_or_volume: null, mrp: null,
      unitPrice: 0, price: 0, discount: 0, gst_percent: null,
      sub: "Other", category: draft.category, category_id: draft.category_id,
      subcategory_id: null, confidence: 0.5,
    };
    setDraft({ ...draft, items: [...draft.items, blank] });
  }

  const busy = phase === "reading" || phase === "saving";

  return (
    <div className="px-5 pt-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Scan bill</h1>
        <p className="text-xs text-muted-foreground mt-1">Snap a photo. Our AI handles the rest — store, items, brands, categories, currency.</p>
      </div>

      {phase === "idle" && (
        <div className="space-y-3">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()} className="glass-strong w-full p-8 flex flex-col items-center gap-3 shimmer">
            <div className="pulse-ring h-20 w-20 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
              <Camera className="h-10 w-10 text-white" />
            </div>
            <p className="font-semibold">Take a photo</p>
            <p className="text-xs text-muted-foreground">or tap below to upload</p>
          </button>
          <button onClick={() => fileRef.current?.click()} className="glass w-full p-4 flex items-center justify-center gap-2 text-sm font-medium">
            <Upload className="h-4 w-4" /> Choose from gallery
          </button>
        </div>
      )}

      {busy && (
        <div className="space-y-4">
          {preview && (
            <img src={preview} alt="bill" className="w-full rounded-2xl border border-white/10 max-h-56 object-cover opacity-80" />
          )}
          <div className="glass-strong p-6 flex flex-col items-center gap-3">
            <div className="h-14 w-14 rounded-full border-4 border-violet-400/30 border-t-violet-400 animate-spin" />
            <p className="font-medium">{progress}</p>
            <p className="text-xs text-muted-foreground">Categorising every line item automatically</p>
          </div>
        </div>
      )}

      {phase === "review" && draft && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pb-8">
          <div className="glass-strong p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Bill details</p>
              <span className="text-xs text-emerald-300">Edit anything before saving</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Store" value={draft.store} onChange={(v) => setDraft({ ...draft, store: v })} />
              <Field label="Date" value={draft.date ?? ""} onChange={(v) => setDraft({ ...draft, date: v })} placeholder="YYYY-MM-DD" />
              <Field label="Bill #" value={draft.bill_number ?? ""} onChange={(v) => setDraft({ ...draft, bill_number: v || null })} />
              <Field label="Payment" value={draft.payment_mode} onChange={(v) => setDraft({ ...draft, payment_mode: v })} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{draft.items.length} items</p>
              <button onClick={addItem} className="text-xs flex items-center gap-1 text-emerald-300"><Plus className="h-3 w-3" /> Add</button>
            </div>
            {draft.items.map((it, idx) => (
              <div key={idx} className="glass p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <input
                    value={it.name}
                    onChange={(e) => updateItem(idx, { name: e.target.value })}
                    className="flex-1 bg-transparent border-b border-white/10 px-1 py-1 font-medium text-sm focus:outline-none focus:border-violet-400"
                  />
                  <button onClick={() => removeItem(idx)} className="text-rose-300/80 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <MiniField label="Brand" value={it.brand} onChange={(v) => updateItem(idx, { brand: v })} />
                  <MiniField label="Category" value={it.sub} onChange={(v) => updateItem(idx, { sub: v })} />
                  <MiniField label="Size" value={it.unit_weight_or_volume ?? ""} onChange={(v) => updateItem(idx, { unit_weight_or_volume: v || null })} />
                  <MiniField label="Qty" value={String(it.qty)} onChange={(v) => updateItem(idx, { qty: Number(v) || 1 })} />
                  <MiniField label="Unit ₹" value={String(it.unitPrice)} onChange={(v) => updateItem(idx, { unitPrice: Number(v) || 0 })} />
                  <MiniField label="Total ₹" value={String(it.price)} onChange={(v) => updateItem(idx, { price: Number(v) || 0 })} />
                </div>
              </div>
            ))}
          </div>

          <div className="glass-strong p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Grand total</span>
            <span className="text-xl font-bold tabular">{money(draft.items.reduce((s, it) => s + Number(it.price || 0), 0), draft.currency)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setDraft(null); setPhase("idle"); setPreview(null); }} className="glass py-3 text-sm font-medium">Cancel</button>
            <button onClick={onConfirmDraft} className="py-3 text-sm font-semibold rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white glow-violet">Confirm & save</button>
          </div>
        </motion.div>
      )}

      {phase === "dup" && dup && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="glass-strong p-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Looks like a duplicate</p>
              <p className="text-xs text-muted-foreground mt-1">
                You already scanned a bill from <span className="text-foreground font-medium">{dup.store}</span> on {shortDate(dup.bill_date)} for {money(dup.total, dup.currency)}.
              </p>
            </div>
          </div>
          {preview && <img src={preview} alt="bill" className="w-full rounded-2xl border border-white/10 max-h-44 object-cover" />}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onViewOriginal} className="glass py-3 text-sm font-medium">View original</button>
            <button onClick={onSaveAnyway} className="py-3 text-sm font-semibold rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white">Review & save</button>
          </div>
          <button onClick={onCancelDup} className="w-full text-xs text-muted-foreground">Cancel</button>
        </motion.div>
      )}

      {phase === "done" && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-strong p-6 flex flex-col items-center gap-3">
          <CheckCircle2 className="h-14 w-14 text-emerald-400" />
          <p className="font-semibold">{progress}</p>
          <p className="text-xs text-muted-foreground">Taking you home…</p>
        </motion.div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
      />
    </label>
  );
}
function MiniField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-violet-400"
      />
    </label>
  );
}

function prettyCat(key: string) {
  if (!key) return "Other";
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}