import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — BillSnap" },
      { name: "description", content: "The rules for using BillSnap: your account, acceptable use, AI accuracy limits and data ownership." },
      { property: "og:title", content: "Terms of Service — BillSnap" },
      { property: "og:description", content: "Account rules, acceptable use and AI accuracy limits for BillSnap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="text-xs text-muted-foreground">Last updated {new Date().getFullYear()}</p>

      <section className="glass p-5 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Your account</h2>
        <p>You are responsible for keeping your login credentials secure and for the activity that happens under your account. One account per person; households are the supported way to share data.</p>
      </section>

      <section className="glass p-5 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Acceptable use</h2>
        <p>Upload only bills and receipts you are entitled to. Don't upload unlawful content, try to break our security, scrape the service, or resell access without permission.</p>
      </section>

      <section className="glass p-5 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">AI accuracy</h2>
        <p>Item extraction, categorisation, refill predictions and inflation trends are generated automatically and can be wrong. Always review extracted items before saving. BillSnap is a tracking tool, not financial, tax or medical advice.</p>
      </section>

      <section className="glass p-5 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Your data stays yours</h2>
        <p>You own the bills and purchase data you add. You can export or delete it at any time. We may keep anonymous, aggregate usage counts to operate and improve the service.</p>
      </section>

      <section className="glass p-5 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Availability &amp; liability</h2>
        <p>The service is provided "as is" without warranties. We aren't liable for indirect losses arising from use of the app, or for decisions made based on automated insights. We may suspend accounts that violate these terms.</p>
      </section>

      <section className="glass p-5 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Changes</h2>
        <p>We may update these terms as the product evolves. Continued use after an update means you accept the revised terms.</p>
      </section>

      <p className="text-xs text-muted-foreground">
        See also our <Link to="/privacy" className="text-violet-300">Privacy Policy</Link>.
      </p>
    </main>
  );
}