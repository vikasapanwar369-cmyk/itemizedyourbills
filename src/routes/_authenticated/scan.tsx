import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { scanBill, checkDuplicateBill, type ScannedBill } from "@/lib/bills.functions";
import { supabase } from "@/integrations/supabase/client";
import { computeImagePhash, computeContentHash } from "@/lib/imageHash";
import { shortDate } from "@/lib/format";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [{ title: "Scan bill — BillSnap" }] }),
  component: ScanPage,
});

type Phase = "idle" | "reading" | "saving" | "dup" | "done";
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

      setProgress("Reading bill with AI…");
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

      await persistBill(file, bill, phash, contentHash);
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
        category: bill.category,
        total: computedTotal,
        subtotal: bill.subtotal || 0,
        tax: bill.tax || 0,
        discount: bill.discount || 0,
        currency: bill.currency || "INR",
        country: bill.country || "IN",
        locale: bill.locale || "en-IN",
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
        qty: Number(it.qty) || 1,
        unit: it.unit || "pcs",
        unit_price: Number(it.unitPrice) || 0,
        price: Number(it.price) || 0,
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
      setProgress(`Saved ${bill.items.length} items from ${bill.store}`);
      qc.invalidateQueries();
      toast.success(`Bill saved · ${bill.items.length} items categorized`);
      setTimeout(() => navigate({ to: "/home" }), 900);
  }

  async function onSaveAnyway() {
    if (!pendingFile || !pendingPhash) return;
    try {
      let bill = pendingBill;
      if (!bill) {
        setPhase("reading");
        setProgress("Reading bill with AI…");
        const base64 = await fileToBase64(pendingFile);
        bill = await runScan({ data: { imageBase64: base64, mimeType: pendingFile.type || "image/jpeg" } });
      }
      const contentHash = await computeContentHash({
        store: bill.store,
        date: bill.date ?? new Date().toISOString(),
        total: Number(bill.total) || bill.items.reduce((s, it) => s + Number(it.price || 0), 0),
        items: bill.items.map((it) => it.name),
      });
      await persistBill(pendingFile, bill, pendingPhash, contentHash);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
      setPhase("idle");
      setPreview(null);
    } finally {
      setDup(null);
      setPendingFile(null);
      setPendingBill(null);
      setPendingPhash("");
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
            <button onClick={onSaveAnyway} className="py-3 text-sm font-semibold rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white">Save anyway</button>
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