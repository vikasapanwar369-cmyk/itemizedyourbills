import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { LifeBuoy, Search, Users, Receipt, Package, Home as HomeIcon, Activity } from "lucide-react";
import { getAdminOverview, lookupUser } from "@/lib/admin.functions";
import { fullDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Support Tools — BillSnap" },
      { name: "description", content: "Internal BillSnap support console: platform usage stats and account lookup for staff." },
      { property: "og:title", content: "Support Tools — BillSnap" },
      { property: "og:description", content: "Staff-only support console for BillSnap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Lookup = Awaited<ReturnType<typeof lookupUser>>;

function AdminPage() {
  const fetchOverview = useServerFn(getAdminOverview);
  const find = useServerFn(lookupUser);
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

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="glass p-4">
      <div className="text-violet-300">{icon}</div>
      <p className="mt-1.5 text-2xl font-bold tabular">{value.toLocaleString("en-IN")}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}