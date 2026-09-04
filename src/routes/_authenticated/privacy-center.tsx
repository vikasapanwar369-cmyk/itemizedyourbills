import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck, Check, X, FileText, Send, Trash2, Clock, Scale, ChevronRight, Mail,
} from "lucide-react";
import {
  getMyConsents, setConsent, getMyDataRequests, createDataRequest, eraseMyAccount,
} from "@/lib/dpdp.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/privacy-center")({
  head: () => ({
    meta: [
      { title: "Privacy Centre — Your Data Rights | BillSnap" },
      { name: "description", content: "Manage purpose-wise consent, request access or correction of your data, raise a grievance, or erase your BillSnap account under India's DPDP Act, 2023." },
      { property: "og:title", content: "Privacy Centre — Your Data Rights | BillSnap" },
      { property: "og:description", content: "Purpose-wise consent, data access, correction, erasure and grievance redressal in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyCentre,
});

const KINDS = [
  { key: "access", label: "Get a summary of my data", hint: "Which of your details we hold and who they were shared with." },
  { key: "correction", label: "Correct or complete my data", hint: "Tell us what is wrong — a store name, an amount, a category." },
  { key: "erasure", label: "Erase specific data", hint: "Ask us to delete particular bills or details." },
  { key: "withdrawal", label: "Withdraw a consent", hint: "Stop a specific use of your data." },
  { key: "nominee", label: "Nominate someone", hint: "Name a person who may act for you if you cannot." },
  { key: "grievance", label: "Raise a grievance", hint: "Unhappy with how a request was handled?" },
] as const;

function PrivacyCentre() {
  const qc = useQueryClient();
  const fetchConsents = useServerFn(getMyConsents);
  const saveConsent = useServerFn(setConsent);
  const fetchRequests = useServerFn(getMyDataRequests);
  const submitRequest = useServerFn(createDataRequest);
  const erase = useServerFn(eraseMyAccount);

  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>("access");
  const [details, setDetails] = useState("");
  const [erasing, setErasing] = useState(false);

  const { data: consents } = useQuery({ queryKey: ["dpdp-consents"], queryFn: () => fetchConsents() });
  const { data: requests } = useQuery({ queryKey: ["dpdp-requests"], queryFn: () => fetchRequests() });

  const toggle = useMutation({
    mutationFn: (v: { purpose: string; granted: boolean }) => saveConsent({ data: v as never }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dpdp-consents"] });
      toast.success("Your choice has been recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: () => submitRequest({ data: { kind, details } }),
    onSuccess: () => {
      setDetails("");
      qc.invalidateQueries({ queryKey: ["dpdp-requests"] });
      toast.success("Request logged — we respond within 30 days");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function eraseAccount() {
    if (!confirm("This deletes your bills, photos, budgets, lists AND your login. It cannot be undone. Continue?")) return;
    if (!confirm("Final check — have you downloaded a backup from Settings?")) return;
    setErasing(true);
    try {
      await erase({ data: { confirm: "DELETE" } });
      toast.success("Everything has been erased");
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not erase the account");
      setErasing(false);
    }
  }

  return (
    <div className="px-5 pt-8 space-y-6 pb-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Privacy Centre</h1>
        <p className="text-xs text-muted-foreground">
          Your rights under India's Digital Personal Data Protection Act, 2023. Notice version{" "}
          {consents?.noticeVersion ?? "—"}.
        </p>
      </header>

      {/* Purpose-wise consent */}
      <section className="glass p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          <p className="font-semibold">What you've agreed to</p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Each use of your data is listed separately. You can switch the optional ones off at any time — the app keeps
          working, that feature just stops.
        </p>
        <div className="space-y-2">
          {consents?.purposes.map((p) => (
            <div key={p.key} className="rounded-xl bg-white/[0.04] p-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{p.why}</p>
                  {p.required && (
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-amber-300">Essential to the service</p>
                  )}
                </div>
                {p.required ? (
                  <span className="mt-0.5 flex h-7 items-center rounded-full bg-white/[0.06] px-3 text-[11px] text-muted-foreground">
                    Always on
                  </span>
                ) : (
                  <button
                    onClick={() => toggle.mutate({ purpose: p.key, granted: !p.granted })}
                    disabled={toggle.isPending}
                    aria-label={`${p.granted ? "Withdraw" : "Give"} consent for ${p.label}`}
                    className={`mt-0.5 flex h-7 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold transition ${
                      p.granted ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.06] text-muted-foreground"
                    }`}
                  >
                    {p.granted ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {p.granted ? "Allowed" : "Off"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rights requests */}
      <section className="glass p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-violet-300" />
          <p className="font-semibold">Make a request</p>
        </div>
        <div className="space-y-2">
          {KINDS.map((k) => (
            <button
              key={k.key}
              onClick={() => setKind(k.key)}
              className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                kind === k.key ? "bg-violet-500/15 ring-1 ring-violet-400/40" : "bg-white/[0.04]"
              }`}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">{k.label}</span>
                <span className="block text-[11px] text-muted-foreground">{k.hint}</span>
              </span>
              {kind === k.key && <Check className="mt-1 h-4 w-4 text-violet-300" />}
            </button>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Add any detail that helps us act on this…"
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-violet-400 transition"
        />
        <button
          onClick={() => send.mutate()}
          disabled={send.isPending || details.trim().length < 3}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> {send.isPending ? "Sending…" : "Submit request"}
        </button>
        <p className="text-[11px] text-muted-foreground">
          Instant options: download everything yourself from{" "}
          <Link to="/settings" className="text-violet-300">Settings → Data &amp; backups</Link>, or edit any bill from its
          detail screen.
        </p>
      </section>

      {/* Request history */}
      {!!requests?.length && (
        <section className="glass p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-sky-300" />
            <p className="font-semibold">Your requests</p>
          </div>
          {requests.map((r) => (
            <div key={r.id} className="rounded-xl bg-white/[0.04] p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium capitalize">{r.kind}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    r.status === "open" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"
                  }`}
                >
                  {r.status}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">{r.details}</p>
              {r.resolution && <p className="text-[11px] text-emerald-300">Reply: {r.resolution}</p>}
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" /> {new Date(r.created_at).toLocaleDateString("en-IN")}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Grievance officer */}
      <section className="glass p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-amber-300" />
          <p className="font-semibold">Grievance Officer</p>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          If a request isn't handled to your satisfaction, our Grievance Officer will review it. Write to{" "}
          <span className="text-foreground">grievance@billsnap.app</span> or raise a grievance above. We reply within 30
          days. You may then approach the Data Protection Board of India.
        </p>
        <Link to="/privacy" className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">Read the full privacy notice</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </section>

      {/* Erasure */}
      <section className="glass p-5 space-y-3 border border-rose-500/20">
        <p className="font-semibold text-rose-300">Erase everything, including my login</p>
        <p className="text-[11px] text-muted-foreground">
          Withdraws all consent and permanently deletes your bills, photos, budgets, lists, alerts and your account.
          This cannot be undone.
        </p>
        <button
          onClick={eraseAccount}
          disabled={erasing}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500/15 px-4 py-2.5 text-sm font-semibold text-rose-300 disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" /> {erasing ? "Erasing…" : "Delete my account & all data"}
        </button>
      </section>
    </div>
  );
}
