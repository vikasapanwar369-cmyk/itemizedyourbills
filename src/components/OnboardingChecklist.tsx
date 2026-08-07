import { Link } from "@tanstack/react-router";
import { Camera, Check, Target, ShoppingCart, Users, Sparkles } from "lucide-react";

export type OnboardingState = {
  scannedBill: boolean;
  setBudget: boolean;
  hasShoppingItems: boolean;
  inHousehold: boolean;
};

const STEPS = [
  { key: "scannedBill", label: "Scan your first bill", hint: "AI reads every item, brand and price", to: "/scan", icon: Camera },
  { key: "setBudget", label: "Set a monthly budget", hint: "Cap spend per category and track pace", to: "/budgets", icon: Target },
  { key: "hasShoppingItems", label: "Build a shopping list", hint: "Auto-add refills from your habits", to: "/shopping", icon: ShoppingCart },
  { key: "inHousehold", label: "Invite your household", hint: "Share bills and budgets with family", to: "/household", icon: Users },
] as const;

export function OnboardingChecklist({ state }: { state: OnboardingState }) {
  const done = STEPS.filter((s) => state[s.key]).length;
  if (done === STEPS.length) return null;

  return (
    <div className="glass-strong relative overflow-hidden p-5 space-y-4">
      <div className="absolute -top-16 -right-10 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-300" />
        <p className="font-semibold">Get set up</p>
        <span className="ml-auto text-xs text-muted-foreground tabular">{done}/{STEPS.length} done</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all"
          style={{ width: `${(done / STEPS.length) * 100}%` }}
        />
      </div>
      <div className="space-y-2">
        {STEPS.map((s) => {
          const complete = state[s.key];
          const Icon = s.icon;
          return (
            <Link
              key={s.key}
              to={s.to as "/home"}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${complete ? "opacity-55" : "bg-white/[0.04] hover:bg-white/[0.08]"}`}
            >
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${complete ? "bg-emerald-500/20 text-emerald-300" : "bg-violet-500/20 text-violet-300"}`}>
                {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${complete ? "line-through" : ""}`}>{s.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">{s.hint}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}