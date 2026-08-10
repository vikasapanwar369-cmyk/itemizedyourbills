import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie } from "lucide-react";

const KEY = "billsnap.consent.v1";

export type ConsentValue = { essential: true; analytics: boolean; at: string };

export function readConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ConsentValue) : null;
  } catch {
    return null;
  }
}

export function writeConsent(analytics: boolean) {
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ essential: true, analytics, at: new Date().toISOString() } satisfies ConsentValue),
    );
  } catch {
    /* storage blocked — treat as essential-only */
  }
  window.dispatchEvent(new Event("billsnap-consent"));
}

export function clearConsent() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("billsnap-consent"));
}

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const sync = () => setShow(readConsent() === null);
    sync();
    window.addEventListener("billsnap-consent", sync);
    return () => window.removeEventListener("billsnap-consent", sync);
  }, []);

  if (!show) return null;

  const decide = (analytics: boolean) => {
    writeConsent(analytics);
    setShow(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        role="dialog"
        aria-label="Cookie preferences"
        className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4"
      >
        <div className="glass-strong mx-auto max-w-md space-y-3 p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-300">
              <Cookie className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">Your privacy choice</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                We only need essential storage to keep you signed in. Optional analytics help us see which screens
                are used, never your bill contents. Read the{" "}
                <Link to="/cookies" className="text-violet-300">cookie notice</Link> or{" "}
                <Link to="/privacy" className="text-violet-300">privacy policy</Link>.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => decide(false)}
              className="flex-1 rounded-xl bg-white/[0.06] px-3 py-2.5 text-xs font-medium"
            >
              Essential only
            </button>
            <button
              onClick={() => decide(true)}
              className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 px-3 py-2.5 text-xs font-semibold text-white"
            >
              Accept all
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
