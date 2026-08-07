import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — BillSnap" },
      { name: "description", content: "How BillSnap collects, stores and protects your bill photos, purchase data and account details." },
      { property: "og:title", content: "Privacy Policy — BillSnap" },
      { property: "og:description", content: "How BillSnap handles your bill photos, purchase data and account details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-xs text-muted-foreground">Last updated {new Date().getFullYear()}</p>

      <section className="glass p-5 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">What we collect</h2>
        <p>Your email address and password (stored hashed, never in plain text), the bill photos you upload, and the purchase details extracted from them — store, date, items, brands, quantities and prices.</p>
      </section>

      <section className="glass p-5 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">How we use it</h2>
        <p>Bill photos are sent to our AI provider solely to extract the items on them. Extracted data powers your dashboards, budgets, shopping lists, refill predictions and inflation trends. We do not sell your data or use it for advertising.</p>
      </section>

      <section className="glass p-5 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Who can see your data</h2>
        <p>Only you — and, if you join a household, the members of that household can view the shared bills and budgets. Row-level security rules in our database enforce this on every request. Support staff can see usage counts and account metadata, never your bill contents.</p>
      </section>

      <section className="glass p-5 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Storage &amp; security</h2>
        <p>Bill images live in a private storage bucket that is not publicly readable. Traffic is encrypted in transit. Passwords are checked against known breach lists at sign-up.</p>
      </section>

      <section className="glass p-5 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Your rights</h2>
        <p>You can export a full copy of your data at any time, and you can permanently erase every bill, item, budget and list from Settings → Data &amp; backups. Deletion is immediate and cannot be undone.</p>
      </section>

      <section className="glass p-5 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Contact</h2>
        <p>Questions about your data? Reach us from the in-app support screen and we'll respond as quickly as we can.</p>
      </section>

      <p className="text-xs text-muted-foreground">
        See also our <Link to="/terms" className="text-violet-300">Terms of Service</Link>.
      </p>
    </main>
  );
}