import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

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