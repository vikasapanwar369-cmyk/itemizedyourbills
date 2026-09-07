import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy & DPDP Notice — BillSnap" },
      { name: "description", content: "BillSnap's privacy notice under India's Digital Personal Data Protection Act, 2023: what we collect, why, how long we keep it, your rights and our Grievance Officer." },
      { property: "og:title", content: "Privacy Policy & DPDP Notice — BillSnap" },
      { property: "og:description", content: "What BillSnap collects, why, retention periods, your DPDP rights and grievance redressal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass p-5 space-y-3 text-sm text-muted-foreground">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>
      <h1 className="text-3xl font-bold">Privacy Policy &amp; DPDP Notice</h1>
      <p className="text-xs text-muted-foreground">
        Notice version 2026-09-v1 · Issued under Section 5 of the Digital Personal Data Protection Act, 2023 (India)
      </p>

      <Section title="Who is responsible for your data">
        <p>
          BillSnap is the <strong className="text-foreground">Data Fiduciary</strong> for the personal data described
          here. You are the <strong className="text-foreground">Data Principal</strong>. We process your data only for
          the purposes listed below, only for as long as needed, and only with your consent.
        </p>
      </Section>

      <Section title="What we collect and exactly why (itemised notice)">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-foreground">Email &amp; password</strong> — to create and secure your account. Passwords are stored hashed, never in plain text.</li>
          <li><strong className="text-foreground">Bill photos</strong> — so the AI reader can extract the items printed on them.</li>
          <li><strong className="text-foreground">Extracted purchase details</strong> (store, date, bill number, items, brands, quantities, prices, taxes, payment mode) — to power your dashboards, budgets, shopping lists, refill predictions and price trends.</li>
          <li><strong className="text-foreground">Household membership</strong> — if you join a household, to share bills and budgets with its members.</li>
          <li><strong className="text-foreground">Support messages and data requests</strong> — to answer you and keep a record of how the request was handled.</li>
          <li><strong className="text-foreground">Optional usage counts</strong> — only if you accept analytics; screen-level counts, never bill contents.</li>
        </ul>
        <p>
          We do not sell your data, do not use it for advertising, and do not use it to train any AI model.
        </p>
      </Section>

      <Section title="Consent, and withdrawing it">
        <p>
          Each purpose above is consented to separately. Optional purposes can be switched off at any time in the{" "}
          <Link to={"/privacy-center" as "/privacy"} className="text-violet-300">Privacy Centre</Link> — as easily as
          they were switched on. Two purposes (storing your bills, and sending the photo to the AI reader) are essential
          to the service; withdrawing those means deleting your account, which you can also do yourself from the Privacy
          Centre.
        </p>
      </Section>

      <Section title="Who your data is shared with (processors)">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-foreground">Our cloud database &amp; storage provider</strong> — hosts your account, bills and images under contract, processing only on our instructions.</li>
          <li><strong className="text-foreground">Our AI reader provider</strong> — receives a bill image solely to return the text and items on it.</li>
          <li><strong className="text-foreground">Household members</strong> — only those you choose to join.</li>
        </ul>
        <p>
          Data may be processed on servers outside India, which the DPDP Act permits except for countries the Government
          restricts. Every processor is bound by contract to the purposes above.
        </p>
      </Section>

      <Section title="How long we keep it (retention)">
        <ul className="list-disc space-y-2 pl-5">
          <li>Bills, items, budgets and lists: kept while your account is active, because they are the history the app exists to show you.</li>
          <li>Deleted items and bills: removed immediately, not archived.</li>
          <li>On account erasure: bills, items, photos, budgets, lists, alerts and the login itself are deleted right away.</li>
          <li>Support and data-request records: kept up to 12 months as proof that we acted on your request.</li>
        </ul>
      </Section>

      <Section title="Your rights as a Data Principal">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-foreground">Access</strong> (Sec. 11) — download a complete copy of your data any time from Settings → Data &amp; backups, or ask us for a summary of what we hold and who we shared it with.</li>
          <li><strong className="text-foreground">Correction &amp; completion</strong> (Sec. 12) — edit any bill or item in the app, or ask us to correct it.</li>
          <li><strong className="text-foreground">Erasure</strong> (Sec. 12) — delete individual bills, wipe all your records, or delete your entire account.</li>
          <li><strong className="text-foreground">Grievance redressal</strong> (Sec. 13) — raise a grievance with us first; we respond within 30 days.</li>
          <li><strong className="text-foreground">Nomination</strong> (Sec. 14) — nominate a person to exercise these rights for you in case of death or incapacity.</li>
        </ul>
        <p>
          All of these can be started in the{" "}
          <Link to={"/privacy-center" as "/privacy"} className="text-violet-300">Privacy Centre</Link>.
        </p>
      </Section>

      <Section title="Your duties (Sec. 15)">
        <p>
          Please give accurate details, don't impersonate anyone else, and don't file false or frivolous grievances — the
          Act makes these your responsibility as a Data Principal.
        </p>
      </Section>

      <Section title="Children and persons with a guardian">
        <p>
          BillSnap is not intended for anyone under 18. We do not knowingly process a child's data, and we never track,
          profile or target advertising at children. If a guardian's consent is required, please do not use the app until
          we can verify it; write to us and we will delete any such data.
        </p>
      </Section>

      <Section title="Security safeguards">
        <p>
          Bill images live in a private storage area that is not publicly readable. Every database request is filtered by
          row-level security rules so only you — and any household you join — can read your records. Traffic is encrypted
          in transit, and passwords are checked against known breach lists at sign-up. If a personal data breach occurs,
          we will notify you and the Data Protection Board of India as the Act requires.
        </p>
      </Section>

      <Section title="Grievance Officer &amp; escalation">
        <p>
          Grievance Officer — write to <span className="text-foreground">grievance@billsnap.app</span>, or raise a
          grievance in the Privacy Centre. We acknowledge promptly and respond within 30 days. If you are still not
          satisfied, you may complain to the{" "}
          <strong className="text-foreground">Data Protection Board of India</strong>.
        </p>
      </Section>

      <p className="text-xs text-muted-foreground">
        See also our <Link to="/terms" className="text-violet-300">Terms of Service</Link> and{" "}
        <Link to="/cookies" className="text-violet-300">Cookie Notice</Link>.
      </p>
    </main>
  );
}
