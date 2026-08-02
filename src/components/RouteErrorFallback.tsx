import { useRouter } from "@tanstack/react-router";

export function RouteErrorFallback({ error, reset }: { error: Error; reset?: () => void }) {
  const router = useRouter();
  console.error(error);
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="glass px-6 py-6 max-w-sm text-center space-y-3">
        <h1 className="text-lg font-semibold">This screen didn't load</h1>
        <p className="text-sm text-muted-foreground">
          {error?.message || "Something went wrong. Try again."}
        </p>
        <button
          onClick={() => {
            router.invalidate();
            reset?.();
          }}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}