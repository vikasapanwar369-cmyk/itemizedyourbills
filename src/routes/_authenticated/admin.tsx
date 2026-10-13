import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  LifeBuoy, Search, Users, Receipt, Package, Home as HomeIcon, Activity, Scale,
  Inbox, Rocket, AlertTriangle, ShieldCheck,
} from "lucide-react";
import {
  getAdminOverview, lookupUser, listDataRequests, resolveDataRequest,
} from "@/lib/admin.functions";
import { listTickets, replyToTicket } from "@/lib/tickets.functions";
import { getLaunchScorecard } from "@/lib/launch.functions";
import { grievanceClock, clockLabel } from "@/lib/dpdp-due";
import { SUPPORT_CONFIG } from "@/lib/support-config";
import { toast } from "sonner";
import { fullDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Support Tools — BillSnap" },
      { name: "description", content: "Internal BillSnap support console: message queue, data rights requests and platform usage for staff." },
      { property: "og:title", content: "Support Tools — BillSnap" },
      { property: "og:description", content: "Staff-only support console for BillSnap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Lookup = Awaited<ReturnType<typeof lookupUser>>;
type Ticket = Awaited<ReturnType<typeof listTickets>>[number];

function AdminPage() {
  const fetchOverview = useServerFn(getAdminOverview);
  const find = useServerFn(lookupUser);
  const fetchRequests = useServerFn(listDataRequests);
  const resolve = useServerFn(resolveDataRequest);
  const fetchTickets = useServerFn(listTickets);
  const fetchScorecard = useServerFn(getLaunchScorecard);
  const fetchScorecard = useServerFn(getLaunchScorecard);
  const qc = useQueryClient();

  const { data: requests, refetch: refetchRequests } = useQuery({
    queryKey: ["admin-data-requests"],
    queryFn: () => fetchRequests(),
  });

  const { data: tickets, refetch: refetchTickets } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: () => fetchTickets(),
  });

  const { data: card } = useQuery({
    queryKey: ["admin-launch-scorecard"],
    queryFn: () => fetchScorecard(),
    retry: false,
  });

  async function closeRequest(id: string) {
    const resolution = prompt("How was this request handled? (shared with the person)");
    if (!resolution || resolution.trim().length < 3) return;
    try {
      await resolve({ data: { id, resolution } });
      await refetchRequests();
      toast.success("Request closed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not close the request");
    }
  }

  const [email, setEmail] = useState("");
  const [result, setResult] = useState<Lookup | null>(null);
  const [searching, setSearching] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
  });

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setLookupError(null);
    setResult(null);
    try {
      setResult(await find({ data: { email } }));
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setSearching(false);
    }
  }

  if (isLoading) {
    return <div className="px-5 pt-8 text-sm text-muted-foreground">Loading support console…</div>;
  }

  if (error) {
    return (
      <div className="px-5 pt-8">
        <div className="glass p-6 text-center space-y-2">
          <LifeBuoy className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="font-semibold">Staff access only</p>
          <p className="text-xs text-muted-foreground">This console is limited to accounts with an admin or support role.</p>
        </div>
      </div>
    );
  }

  const t = data!.totals;
  const openTickets = (tickets ?? []).filter((x) => x.status === "open").length;
  const openRequests = (requests ?? []).filter((r) => r.status === "open").length;

  return (
    <div className="px-5 pt-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Support tools</h1>
        <p className="text-xs text-muted-foreground mt-1">Signed in as {data!.roles.join(", ")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<Users className="h-4 w-4" />} value={t.users} label="Total accounts" />
        <Stat icon={<Activity className="h-4 w-4" />} value={t.activeUsers30} label="Active (30d)" />
        <Stat icon={<Receipt className="h-4 w-4" />} value={t.bills} label="Bills scanned" />
        <Stat icon={<Package className="h-4 w-4" />} value={t.items} label="Items extracted" />
        <Stat icon={<HomeIcon className="h-4 w-4" />} value={t.households} label="Households" />
        <Stat icon={<Receipt className="h-4 w-4" />} value={t.billsLast7Days} label="Bills (7d)" />
      </div>

      {/* ---- The two-week launch test -------------------------------- */}
      <section className="glass p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-emerald-300" />
          <p className="font-semibold">Launch test</p>
          {card && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                card.passed ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-muted-foreground"
              }`}
            >
              {card.passed ? "bar cleared" : "bar not cleared yet"}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Bar agreed: at least {card?.targets.scannedTwoBills ?? 5} people scan two bills, and at least{" "}
          {card?.targets.returnedWithin7Days ?? 2} come back on their own within 7 days. Staff and test logins are
          left out of these counts.
        </p>

        <div className="grid grid-cols-3 gap-2">
          <Mini label="People" value={card?.totals.signups ?? 0} />
          <Mini label="Scanned 2+" value={card?.totals.scannedTwoBills ?? 0} />
          <Mini label="Returned ≤7d" value={card?.totals.returnedWithin7Days ?? 0} />
        </div>

        <div className="space-y-1.5">
          {(card?.rows ?? []).slice(0, 12).map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-[11px]">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${r.isStaff ? "bg-white/20" : "bg-violet-400"}`} />
              <span className="flex-1 truncate text-muted-foreground">{r.email}</span>
              <span className="text-muted-foreground/70">{r.source}</span>
              <span className="tabular text-muted-foreground">{r.bills} bills</span>
              <span className="tabular text-muted-foreground">{r.visitDays}d</span>
              {r.scannedTwoBills && <span className="text-emerald-300">2+</span>}
              {r.returnedWithin7Days && <span className="text-emerald-300">↩</span>}
              {r.isStaff && <span className="text-white/30">staff</span>}
            </div>
          ))}
          {!card?.rows.length && <p className="text-xs text-muted-foreground">No accounts yet.</p>}
        </div>
        <p className="text-[10px] text-muted-foreground">
          “bills” = bills scanned · “d” = days they opened the app · ↩ = came back within a week
        </p>
      </section>

      {/* ---- Messages from the Help screen -------------------------- */}
      <section className="glass p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-violet-300" />
          <p className="font-semibold">Messages</p>
          {!!openTickets && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              {openTickets} open
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {SUPPORT_CONFIG.responsePromise} Billing, privacy and bug reports are pulled to the top.
        </p>
        <div className="space-y-2">
          {(tickets ?? []).map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              onDone={async () => {
                await refetchTickets();
                qc.invalidateQueries({ queryKey: ["admin-tickets"] });
              }}
            />
          ))}
          {!tickets?.length && <p className="text-xs text-muted-foreground">No messages yet.</p>}
        </div>
      </section>

      {/* ---- Account lookup ----------------------------------------- */}
      <section className="glass p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-violet-300" />
          <p className="font-semibold">Account lookup</p>
        </div>
        <form onSubmit={search} className="flex gap-2">
          <input
            type="email"
            required
            maxLength={255}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="flex-1 rounded-xl bg-white/[0.06] px-3 py-2 text-sm outline-none"
          />
          <button className="rounded-xl bg-violet-500/20 px-4 text-sm font-semibold text-violet-200" disabled={searching}>
            {searching ? "…" : "Find"}
          </button>
        </form>
        {lookupError && <p className="text-xs text-rose-300">{lookupError}</p>}
        {result && !result.found && <p className="text-xs text-muted-foreground">No account with that email.</p>}
        {result?.found && (
          <div className="rounded-xl bg-white/[0.04] p-3 space-y-1 text-sm">
            <p className="font-medium">{result.user.email}</p>
            <p className="text-[11px] text-muted-foreground">
              Joined {fullDate(result.user.createdAt)} · {result.user.confirmed ? "verified" : "unverified"}
              {result.user.lastSignInAt ? ` · last seen ${fullDate(result.user.lastSignInAt)}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {result.usage.bills} bills · {result.usage.items} items ·{" "}
              {result.usage.inHousehold ? `in a household (${result.usage.householdRole})` : "no household"}
            </p>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Usage counts and account metadata only — bill contents are never shown here.</p>
      </section>

      {/* ---- DPDP rights requests ----------------------------------- */}
      <section className="glass p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-emerald-300" />
          <p className="font-semibold">Data rights requests</p>
          {!!openRequests && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              {openRequests} open
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {SUPPORT_CONFIG.grievancePromise} Every request is acknowledged the moment it arrives.
        </p>
        <div className="space-y-2">
          {(requests ?? []).map((r) => {
            const clock = grievanceClock(r);
            return (
              <div key={r.id} className="rounded-xl bg-white/[0.04] p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium capitalize">{r.kind}</p>
                  <span className="text-[10px] text-muted-foreground">{fullDate(r.created_at)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{r.details}</p>
                <p
                  className={`text-[10px] ${
                    clock.state === "resolved in time"
                      ? "text-emerald-300"
                      : clock.state === "in progress" || clock.state === "not acknowledged yet"
                        ? "text-muted-foreground"
                        : "text-amber-300"
                  }`}
                >
                  {clock.state === "resolved in time" || clock.state === "resolved late"
                    ? `Closed: ${r.resolution ?? "—"}`
                    : clockLabel(clock, (ms) => fullDate(new Date(ms).toISOString()))}
                </p>
                {r.status !== "closed" && (
                  <button
                    onClick={() => closeRequest(r.id)}
                    className="mt-1 rounded-lg bg-violet-500/15 px-3 py-1.5 text-[11px] font-semibold text-violet-300"
                  >
                    Record outcome &amp; close
                  </button>
                )}
              </div>
            );
          })}
          {!requests?.length && <p className="text-xs text-muted-foreground">No requests yet.</p>}
        </div>
      </section>

      {/* ---- Grievance Officer publish state ------------------------ */}
      <section className="glass p-5 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          <p className="font-semibold">Published contact details</p>
        </div>
        <ContactLine ok={Boolean(SUPPORT_CONFIG.supportInbox.trim())} label="Support inbox" value={SUPPORT_CONFIG.supportInbox || "not set"} />
        <ContactLine ok={Boolean(SUPPORT_CONFIG.whatsappNumber.trim())} label="WhatsApp number" value={SUPPORT_CONFIG.whatsappNumber || "not set"} />
        <ContactLine
          ok={Boolean(SUPPORT_CONFIG.grievanceOfficer.name.trim() && SUPPORT_CONFIG.grievanceOfficer.email.trim() && SUPPORT_CONFIG.grievanceOfficer.address.trim())}
          label="Grievance Officer"
          value={SUPPORT_CONFIG.grievanceOfficer.name || "not set"}
        />
        <p className="text-[10px] text-muted-foreground">
          Anything marked “not set” is hidden from the public privacy notice and help screen. Fill all three in
          src/lib/support-config.ts.
        </p>
      </section>

      <section className="glass p-5 space-y-3">
        <p className="font-semibold">Recent signups</p>
        <div className="space-y-2">
          {data!.recentSignups.map((u) => (
            <div key={u.id} className="flex items-center gap-3 text-sm">
              <span className={`h-2 w-2 rounded-full ${u.confirmed ? "bg-emerald-400" : "bg-amber-400"}`} />
              <span className="flex-1 truncate">{u.email}</span>
              <span className="text-[11px] text-muted-foreground">{fullDate(u.createdAt)}</span>
            </div>
          ))}
          {data!.recentSignups.length === 0 && <p className="text-xs text-muted-foreground">No signups yet.</p>}
        </div>
      </section>
    </div>
  );
}

function TicketRow({ ticket, onDone }: { ticket: Ticket; onDone: () => Promise<void> }) {
  const answer = useServerFn(replyToTicket);
  const [reply, setReply] = useState(ticket.staff_reply ?? "");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function send(status: "open" | "resolved") {
    if (reply.trim().length < 3) {
      toast.error("Write a reply first (at least 3 characters)");
      return;
    }
    setBusy(true);
    try {
      await answer({ data: { id: ticket.id, reply: reply.trim(), status } });
      toast.success(status === "resolved" ? "Reply sent and closed" : "Reply saved");
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the reply");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`rounded-xl p-3 space-y-1.5 ${ticket.priority ? "bg-violet-500/[0.08] ring-1 ring-violet-400/20" : "bg-white/[0.04]"}`}>
      <div className="flex items-center gap-2">
        {ticket.priority && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
        <p className="text-sm font-medium flex-1 truncate">{ticket.subject}</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] capitalize ${
            ticket.status === "open" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"
          }`}
        >
          {ticket.status}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {ticket.email} · {ticket.topic} · {fullDate(ticket.created_at)}
        {ticket.fromStaff ? " · staff account" : ""}
      </p>
      <p className="text-xs text-muted-foreground">{ticket.message}</p>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="mt-1 rounded-lg bg-violet-500/15 px-3 py-1.5 text-[11px] font-semibold text-violet-300"
        >
          {ticket.staff_reply ? "Edit reply" : "Reply"}
        </button>
      )}
      {open && (
        <div className="space-y-2 pt-1">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Your reply — the person sees this on their Help screen."
            className="w-full rounded-xl bg-white/[0.06] px-3 py-2 text-xs outline-none resize-none"
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => send("open")}
              className="flex-1 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-muted-foreground disabled:opacity-50"
            >
              Save reply
            </button>
            <button
              disabled={busy}
              onClick={() => send("resolved")}
              className="flex-1 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 disabled:opacity-50"
            >
              Send &amp; close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="glass p-4">
      <div className="text-violet-300">{icon}</div>
      <p className="mt-1.5 text-2xl font-bold tabular">{value.toLocaleString("en-IN")}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-2.5 text-center">
      <p className="text-lg font-bold tabular">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ContactLine({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className={ok ? "text-foreground" : "text-amber-300"}>{value}</span>
    </div>
  );
}
