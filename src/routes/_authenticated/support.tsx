import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, ChevronDown, LifeBuoy, Send, ShieldCheck, FileText, Cookie } from "lucide-react";
import { toast } from "sonner";
import { createTicket, getMyTickets } from "@/lib/support.functions";
import { fullDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Help & Support — BillSnap" },
      { name: "description", content: "Answers to common BillSnap questions about scanning, categories, budgets, households and data — plus a direct line to our team." },
      { property: "og:title", content: "Help & Support — BillSnap" },
      { property: "og:description", content: "BillSnap help centre and contact form." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportPage,
});

const FAQS: Array<{ q: string; a: string }> = [
  { q: "How do I scan a bill?", a: "Tap the camera button in the bottom bar, take a photo of the full bill or pick one from your gallery. The AI reads every line item with brand, quantity, unit and price. You can edit anything on the review screen before saving." },
  { q: "Why is a bill grouped under an older date?", a: "BillSnap always uses the date printed on the bill, not the day you photographed it, so late uploads still land in the right month." },
  { q: "What happens if I scan the same bill twice?", a: "Each bill gets an image fingerprint plus a content fingerprint. If either matches an existing bill, the scan is blocked so your totals never double-count." },
  { q: "An item landed in the wrong category. Can I fix it?", a: "Yes. On the review screen every item has its own category dropdown. Fixing it there also improves how similar items are grouped in reports." },
  { q: "How do refill predictions work?", a: "Once an item appears on two or more bills, BillSnap measures the average gap between purchases and predicts when you'll run out. Items due within three days show up in Alerts and can be pushed to your shopping list." },
  { q: "How do budgets work?", a: "Set a monthly limit per category. BillSnap compares your spend against the limit and against how far through the month you are, so it can warn you when you're pacing to overspend." },
  { q: "What does a household share?", a: "Everyone in a household sees the same bills, items, budgets, shopping list and insights. Each person can still only edit or delete records they created." },
  { q: "Can I export or delete my data?", a: "Settings → Data & backups gives you a full JSON backup plus item and bill CSV exports, and a permanent delete option that erases every bill, item, budget and list." },
  { q: "Are my bill photos private?", a: "Bill images are stored in a private bucket that isn't publicly readable, and database rules restrict every row to you and your household. Support staff can see usage counts only, never bill contents." },
];

const TOPICS = ["general", "scanning", "billing", "data & privacy", "bug report"];

function SupportPage() {
  const fetchTickets = useServerFn(getMyTickets);
  const submit = useServerFn(createTicket);
  const qc = useQueryClient();
  const [open, setOpen] = useState<number | null>(0);
  const [topic, setTopic] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const { data: tickets } = useQuery({ queryKey: ["support-tickets"], queryFn: () => fetchTickets() });

  const send = useMutation({
    mutationFn: () => submit({ data: { subject, message, topic } }),
    onSuccess: () => {
      toast.success("Message sent — we'll reply here");
      setSubject(""); setMessage("");
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-5 pt-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link to={"/home" as "/home"} aria-label="Back" className="glass h-9 w-9 flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Help &amp; support</h1>
          <p className="text-xs text-muted-foreground">Answers first, humans second</p>
        </div>
      </div>

      <section className="space-y-2">
        {FAQS.map((f, i) => (
          <div key={f.q} className="glass overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              <span className="text-sm font-medium flex-1">{f.q}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open === i ? "rotate-180" : ""}`} />
            </button>
            {open === i && <p className="px-4 pb-4 text-xs leading-relaxed text-muted-foreground">{f.a}</p>}
          </div>
        ))}
      </section>

      <section className="glass p-5 space-y-3">
        <div className="flex items-center gap-2">
          <LifeBuoy className="h-4 w-4 text-violet-300" />
          <p className="font-semibold">Still stuck? Message us</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={`rounded-full px-3 py-1.5 text-[11px] capitalize ${topic === t ? "bg-violet-500/25 text-violet-200" : "bg-white/[0.05] text-muted-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          maxLength={140}
          className="w-full rounded-xl bg-white/[0.05] px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what happened, and which bill or screen it relates to."
          rows={4}
          maxLength={4000}
          className="w-full rounded-xl bg-white/[0.05] px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground resize-none"
        />
        <button
          disabled={send.isPending}
          onClick={() => send.mutate()}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 px-4 py-3 text-sm font-semibold disabled:opacity-60"
        >
          <Send className="h-4 w-4" /> {send.isPending ? "Sending…" : "Send message"}
        </button>
      </section>

      {(tickets ?? []).length > 0 && (
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Your requests</p>
          {(tickets ?? []).map((t) => (
            <div key={t.id} className="glass p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium flex-1 truncate">{t.subject}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] capitalize ${t.status === "open" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                  {t.status}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">{fullDate(t.created_at)} · {t.topic}</p>
              <p className="text-xs text-muted-foreground">{t.message}</p>
              {t.staff_reply && (
                <p className="rounded-xl bg-violet-500/10 p-3 text-xs text-violet-100">{t.staff_reply}</p>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="glass p-5 space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Policies</p>
        <Link to="/privacy" className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Privacy Policy</Link>
        <Link to="/terms" className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-muted-foreground" /> Terms of Service</Link>
        <Link to="/cookies" className="flex items-center gap-2 text-sm"><Cookie className="h-4 w-4 text-amber-300" /> Cookie &amp; tracking notice</Link>
      </section>
    </div>
  );
}
