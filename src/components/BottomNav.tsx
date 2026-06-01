import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Home, BarChart3, Repeat, Receipt, Camera } from "lucide-react";

type Tab = { to: string; label: string; icon: typeof Home; primary?: boolean };
const TABS: Tab[] = [
  { to: "/home",        label: "Home",    icon: Home },
  { to: "/reports",     label: "Reports", icon: BarChart3 },
  { to: "/scan",        label: "Scan",    icon: Camera, primary: true },
  { to: "/consumption", label: "Usage",   icon: Repeat },
  { to: "/history",     label: "History", icon: Receipt },
];

export function BottomNav() {
  const location = useLocation();
  const activeIdx = TABS.findIndex((t) => location.pathname.startsWith(t.to));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 pt-2">
      <div className="glass-strong relative mx-auto flex max-w-md items-end justify-between gap-1 px-3 py-2">
        {/* sliding indicator */}
        {activeIdx >= 0 && (
          <motion.div
            layout
            className="absolute top-1 h-1 w-10 rounded-full bg-gradient-to-r from-violet to-emerald"
            initial={false}
            animate={{ left: `calc(${(activeIdx / TABS.length) * 100}% + ${100 / TABS.length / 2}% - 20px)` }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            style={{ background: "linear-gradient(90deg, var(--violet), var(--emerald))" }}
          />
        )}
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = location.pathname.startsWith(t.to);
          if (t.primary) {
            return (
              <Link key={t.to} to={t.to as "/scan"} className="-mt-7 flex flex-col items-center" aria-label={t.label}>
                <div className="relative h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-[0_10px_40px_oklch(0.62_0.25_295/0.6)]">
                  <span className="absolute inset-0 rounded-full animate-ping bg-violet-400/40" />
                  <Icon className="h-7 w-7 text-white relative" />
                </div>
                <span className="mt-1 text-[10px] font-medium text-muted-foreground">{t.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={t.to}
              to={t.to as "/home"}
              className={`flex flex-1 flex-col items-center gap-1 py-2 transition ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}