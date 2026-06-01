import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Upload, Save, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { scanBill, type ScannedBill } from "@/lib/bills.functions";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_KEYS, getCategory } from "@/lib/categories";
import { CategoryIcon } from "@/components/CategoryIcon";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [{ title: "Scan bill — BillSnap" }] }),
  component: ScanPage,
});

type EditableBill = ScannedBill & { _file?: File; _preview?: string };

function ScanPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [bill, setBill] = useState<EditableBill | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const runScan = useServerFn(scanBill);

  async function onFile(file: File) {
    setScanning(true);
    setBill(null);
    try {
      const preview = URL.createObjectURL(file);
      const base64 = await fileToBase64(file);
      const result = await runScan({ data: { imageBase64: base64, mimeType: file.type || "image/jpeg" } });
      setBill({ ...result, _file: file, _preview: preview });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function save() {
    if (!bill) return;
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");

      let imageUrl: string | null = null;
      if (bill._file) {
        const path = `${uid}/${crypto.randomUUID()}-${bill._file.name}`;
        const { error: upErr } = await supabase.storage.from("bill-images").upload(path, bill._file, { upsert: false });
        if (!upErr) imageUrl = path;
      }

      const billDate = bill.date ? new Date(bill.date) : new Date();
      const total = bill.items.reduce((s, it) => s + Number(it.price || 0), 0) || bill.total;

      const { data: inserted, error } = await supabase.from("bills").insert({
        user_id: uid,
        store: bill.store || "Unknown",
        bill_date: isNaN(billDate.getTime()) ? new Date().toISOString() : billDate.toISOString(),
        category: bill.category,
        total,
        image_url: imageUrl,
      }).select("id").single();
      if (error) throw error;

      const items = bill.items.map((it) => ({
        bill_id: inserted!.id,
        user_id: uid,
        name: it.name,
        brand: it.brand || "Local",
        qty: Number(it.qty) || 1,
        unit: it.unit || "pcs",
        unit_price: Number(it.unitPrice) || 0,
        price: Number(it.price) || 0,
        sub: it.sub || "Other",
        category: it.category || bill.category,
        bill_date: isNaN(billDate.getTime()) ? new Date().toISOString() : billDate.toISOString(),
      }));
      const { error: itemsErr } = await supabase.from("items").insert(items);
      if (itemsErr) throw itemsErr;

      toast.success("Bill saved!");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-5 pt-8 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Scan bill</h1>
        {bill && (
          <button onClick={() => setBill(null)} className="rounded-full p-2 bg-white/5 border border-white/10">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!bill && !scanning && (
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

      {scanning && (
        <div className="glass p-8 flex flex-col items-center gap-3">
          <div className="h-16 w-16 rounded-full border-4 border-violet-400/30 border-t-violet-400 animate-spin" />
          <p className="font-medium">Reading your bill…</p>
          <p className="text-xs text-muted-foreground">AI is extracting every item</p>
        </div>
      )}

      {bill && (
        <div className="space-y-4">
          {bill._preview && (
            <img src={bill._preview} alt="bill" className="w-full rounded-2xl border border-white/10 max-h-48 object-cover" />
          )}

          <div className="glass p-4 space-y-3">
            <div className="flex items-center gap-3">
              <CategoryIcon category={bill.category} size="md" />
              <div className="flex-1">
                <input
                  className="w-full bg-transparent text-lg font-semibold outline-none"
                  value={bill.store}
                  onChange={(e) => setBill({ ...bill, store: e.target.value })}
                />
                <select
                  value={bill.category}
                  onChange={(e) => setBill({ ...bill, category: e.target.value as ScannedBill["category"] })}
                  className="mt-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs"
                >
                  {CATEGORY_KEYS.map((c) => (
                    <option key={c} value={c}>{getCategory(c).emoji} {getCategory(c).label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {bill.items.map((it, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="glass p-3 space-y-2"
              >
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-transparent font-medium outline-none"
                    value={it.name}
                    onChange={(e) => updateItem(setBill, bill, i, { name: e.target.value })}
                  />
                  <input
                    className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-right text-sm tabular"
                    type="number" step="0.01"
                    value={it.price}
                    onChange={(e) => updateItem(setBill, bill, i, { price: Number(e.target.value) })}
                  />
                </div>
                <div className="flex gap-2 text-xs">
                  <input className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1" placeholder="Brand"
                    value={it.brand} onChange={(e) => updateItem(setBill, bill, i, { brand: e.target.value })} />
                  <input className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 tabular" type="number" step="0.01"
                    value={it.qty} onChange={(e) => updateItem(setBill, bill, i, { qty: Number(e.target.value) })} />
                  <input className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1" placeholder="unit"
                    value={it.unit} onChange={(e) => updateItem(setBill, bill, i, { unit: e.target.value })} />
                  <input className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1" placeholder="Sub"
                    value={it.sub} onChange={(e) => updateItem(setBill, bill, i, { sub: e.target.value })} />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Category</span>
                  <select
                    value={it.category || bill.category}
                    onChange={(e) => updateItem(setBill, bill, i, { category: e.target.value as ScannedBill["category"] })}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1"
                  >
                    {CATEGORY_KEYS.map((c) => (
                      <option key={c} value={c}>{getCategory(c).emoji} {getCategory(c).label}</option>
                    ))}
                  </select>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="glass p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-xl font-bold tabular">{inr(bill.items.reduce((s, it) => s + Number(it.price || 0), 0))}</span>
          </div>

          <button
            onClick={save} disabled={saving}
            className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-600 py-4 font-semibold text-white shadow-lg glow-violet disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="h-5 w-5" /> {saving ? "Saving…" : "Save bill"}
          </button>
        </div>
      )}
    </div>
  );
}

function updateItem(set: (b: EditableBill) => void, bill: EditableBill, i: number, patch: Partial<ScannedBill["items"][number]>) {
  const items = [...bill.items];
  items[i] = { ...items[i], ...patch };
  set({ ...bill, items });
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