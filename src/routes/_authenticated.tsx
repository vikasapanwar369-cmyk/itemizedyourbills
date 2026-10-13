import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { readAttribution } from "@/lib/attribution";
import { recordAttribution, recordVisit } from "@/lib/launch.functions";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const pingVisit = useServerFn(recordVisit);
  const saveSource = useServerFn(recordAttribution);

  // Launch-test instrumentation: one row per day the app is opened, and the
  // outreach message that first brought this person in. Never blocks the UI.
  useEffect(() => {
    if (!ready) return;
    void pingVisit().catch(() => {});
    const attr = readAttribution();
    if (attr) void saveSource({ data: attr }).catch(() => {});
  }, [ready, pingVisit, saveSource]);


  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        if (!data.session?.user) navigate({ to: "/login", replace: true });
        else setReady(true);
      })
      .catch(() => {
        // Network hiccup: keep the screen rather than blanking it out.
        if (active) setReady(true);
      });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Only a real sign-out should send the user to /login. TOKEN_REFRESHED /
      // INITIAL_SESSION events previously redirected and blanked the screen.
      if (event === "SIGNED_OUT") navigate({ to: "/login", replace: true });
      else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") setReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass px-6 py-4 text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28">
      <Outlet />
      <BottomNav />
    </div>
  );
}