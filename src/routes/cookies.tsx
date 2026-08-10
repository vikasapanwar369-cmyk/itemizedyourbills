import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { clearConsent, readConsent, writeConsent, type ConsentValue } from "@/components/CookieConsent";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie & Tracking Notice — BillSnap" },
      { name: "description", content: "What BillSnap stores in your browser, why it is needed, and how to change or withdraw your analytics consent at any time." },
      { property: "og:title", content: "Cookie & Tracking Notice — BillSnap" },
      { property: "og:description", content: "What BillSnap stores in your browser and how to change your consent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  const [consent, setConsent] = useState<ConsentValue | null>(null);

  useEffect(() => {
    const sync = () => setConsent(readConsent());
    sync();
    window.addEventListener("billsnap-consent", sync);
    return () => window.removeEventListener("billsnap-consent", sync);
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>
      <h1 className="text-3xl font-bold">Cookie &amp; tracking notice</h1>
      <p className="text-xs text-muted-foreground">Last updated {new Date().getFullYear()}</p>

      <section className="glass p-5 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Essential storage</h2>
        <p>BillSnap keeps your login session and your consent choice in your browser's local storage. Without it you would be signed out on every page load, so it cannot be switched off.</p>
      </section>

      <section className="glass p-5 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Optional analytics</h2>
        <p>If you accept analytics, we record which screens are opened and how often scans succeed, so we can fix rough edges. We never attach bill contents, item names or prices to that data, and we do not use it for advertising or share it with ad networks.</p>
      </section>

      <section className="glass p-5 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Your control</h2>
        <p>You can change or withdraw consent whenever you like. Withdrawing it stops optional analytics immediately; essential session storage stays.</p>
      </section>

      <section className="glass p-5 space-y-3">
        <p className="text-sm font-semibold">Current choice</p>
        <p className="text-xs text-muted-foreground">
          {consent === null
            ? "Not set yet — the banner will ask on your next visit."
            : consent.analytics
              ? "Essential storage plus optional analytics."
              : "Essential storage only."}
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => writeConsent(false)} className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-medium">
            Essential only
          </button>
          <button onClick={() => writeConsent(true)} className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 px-3 py-2 text-xs font-semibold text-white">
            Accept analytics
          </button>
          <button onClick={() => clearConsent()} className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-medium">
            Reset choice
          </button>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        See also our <Link to="/privacy" className="text-violet-300">Privacy Policy</Link> and{" "}
        <Link to="/terms" className="text-violet-300">Terms of Service</Link>.
      </p>
    </main>
  );
}
