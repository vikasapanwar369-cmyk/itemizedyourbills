import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Camera, Sparkles, PackageCheck, Target, TrendingUp, Users, ShieldCheck,
  Repeat, ArrowRight, ScanLine, Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BillSnap — Snap a bill, track every item with AI" },
      { name: "description", content: "BillSnap reads every line of your grocery, pharmacy and salon bills with AI — item, brand, quantity and price — then tracks budgets, refills and price inflation for your household." },
      { property: "og:title", content: "BillSnap — Snap a bill, track every item with AI" },
      { property: "og:description", content: "AI bill scanning with item-level categories, budgets, refill predictions and personal inflation tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: ScanLine, title: "Item-level extraction", body: "Every line of the bill becomes its own row — name, brand, company, quantity, unit, unit price and MRP." },
  { icon: Sparkles, title: "Store-grade categories", body: "Items are sorted into retail-style categories and subcategories, so dairy never hides inside “groceries”." },
  { icon: PackageCheck, title: "Refill predictions", body: "BillSnap learns how often you buy soap, atta or a medicine and warns you before it runs out." },
  { icon: Target, title: "Budgets that pace you", body: "Set a monthly limit per category and get alerts when your spending is running hot." },
  { icon: TrendingUp, title: "Your own inflation index", body: "See how your real basket price moved over 3, 6, 12 or 24 months — by category, brand or item." },
  { icon: Repeat, title: "Recurring bill radar", body: "Repeating bills are detected automatically with their cadence and next expected date." },
  { icon: Users, title: "Household sharing", body: "Invite family so everyone scans into one shared picture of the month." },
  { icon: ShieldCheck, title: "Duplicate-proof", body: "Image and content fingerprints block the same bill from being counted twice." },
];

const STEPS = [
  { n: "1", title: "Snap the bill", body: "Camera or gallery — paper or printed receipts both work." },
  { n: "2", title: "AI reads it", body: "Items, brands, quantities and prices are extracted with the bill's own date." },
  { n: "3", title: "Review & save", body: "Fix anything you like, then save. Dashboards update instantly." },
];

function Landing() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  const ctaTo = signedIn ? "/home" : "/login";
  const ctaLabel = signedIn ? "Open BillSnap" : "Get started free";

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-600/25 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-emerald-500/15 blur-[120px]" />

      <header className="relative mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <span className="flex items-center gap-2 font-bold tracking-tight">
          <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
            <Camera className="h-4 w-4 text-white" />
          </span>
          BillSnap
        </span>
        <Link to={ctaTo as "/home"} className="glass px-4 py-2 text-xs font-medium">
          {signedIn ? "Dashboard" : "Sign in"}
        </Link>
      </header>

      <section className="relative mx-auto max-w-3xl px-5 pt-8 pb-14 text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] text-violet-200"
        >
          <Sparkles className="h-3.5 w-3.5" /> AI bill scanning built for Indian households
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="mt-5 text-4xl font-bold leading-tight sm:text-5xl"
        >
          Snap a bill.<br />
          <span className="bg-gradient-to-r from-violet-300 to-emerald-300 bg-clip-text text-transparent">
            Know every item you buy.
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground"
        >
          BillSnap turns a photo of any grocery, pharmacy, salon or appliance bill into clean item-level data —
          then tracks budgets, refills, repeat purchases and your personal inflation.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <Link
            to={ctaTo as "/home"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_40px_oklch(0.62_0.25_295/0.45)] sm:w-auto"
          >
            {ctaLabel} <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#how" className="glass w-full px-6 py-3.5 text-center text-sm font-medium sm:w-auto">
            See how it works
          </a>
        </motion.div>
        <p className="mt-4 text-[11px] text-muted-foreground">No card needed · Your bills stay private</p>
      </section>

      <section id="how" className="relative mx-auto max-w-3xl px-5 pb-14">
        <h2 className="text-center text-2xl font-bold">Three taps, no typing</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="glass p-5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/20 text-sm font-bold text-violet-200">
                {s.n}
              </span>
              <p className="mt-3 font-semibold">{s.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-5xl px-5 pb-14">
        <h2 className="text-center text-2xl font-bold">Everything a spending tracker should do</h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted-foreground">
          Not just totals — BillSnap understands the things inside your bills.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: (i % 4) * 0.04 }}
                className="glass p-5"
              >
                <Icon className="h-5 w-5 text-emerald-300" />
                <p className="mt-3 font-semibold">{f.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.body}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="relative mx-auto max-w-3xl px-5 pb-16">
        <div className="glass-strong space-y-4 p-7 text-center">
          <h2 className="text-2xl font-bold">Start with your last bill</h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Scan one bill and you already get item-level categories. Scan a second and BillSnap starts predicting
            refills, repeats and price changes.
          </p>
          <ul className="mx-auto flex max-w-sm flex-col gap-2 text-left text-xs text-muted-foreground">
            {["Unlimited categories and subcategories", "Shared household view", "Full data export whenever you want"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-300" /> {t}
              </li>
            ))}
          </ul>
          <Link
            to={ctaTo as "/home"}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 px-6 py-3.5 text-sm font-semibold text-white"
          >
            {ctaLabel} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="relative mx-auto max-w-5xl px-5 pb-24 text-center text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/cookies" className="hover:text-foreground">Cookies</Link>
        </div>
        <p className="mt-4">© {new Date().getFullYear()} BillSnap</p>
      </footer>
    </main>
  );
}
