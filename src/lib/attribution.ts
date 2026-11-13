/**
 * First-touch attribution.
 *
 * Reads `?from=` / `?utm_source=` off the landing page URL and remembers it
 * until the person signs up, so the support console can show which outreach
 * message actually brought someone in. Runs in the browser only.
 */

const KEY = "billsnap_attribution";
const REFERRAL_KEY = "billsnap_referral_code";

export interface Attribution {
  source: string;
  campaign: string | null;
  referrer: string | null;
}

export function buildReferralLink(origin: string, code: string): string {
  const url = new URL("/", origin);
  const safeCode = code.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 20);
  url.searchParams.set("from", `ref-${safeCode}`);
  return url.toString();
}

/** Stable per-browser referral link; the random token carries no account data. */
export function getReferralLink(origin: string): string {
  let code: string;
  try {
    code = localStorage.getItem(REFERRAL_KEY) ?? "";
    if (!code) {
      code = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
      localStorage.setItem(REFERRAL_KEY, code);
    }
  } catch {
    code = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  }
  return buildReferralLink(origin, code);
}

/** Keep only short, boring tokens — never store arbitrary URL junk. */
function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 40);
  return trimmed.length >= 2 ? trimmed : null;
}

/** Call on mount of the landing page and the sign-in screen. */
export function captureAttribution(search: string, referrer: string): void {
  try {
    const params = new URLSearchParams(search);
    const source =
      clean(params.get("from")) ??
      clean(params.get("utm_source")) ??
      clean(params.get("ref")) ??
      clean(params.get("utm_campaign"));
    if (!source) return;
    const campaign = clean(params.get("utm_campaign"));
    const ref = clean(referrer) ?? clean(document.referrer);
    localStorage.setItem(KEY, JSON.stringify({ source, campaign, referrer: ref }));
  } catch {
    // Private mode / storage disabled: attribution is a nice-to-have, never fatal.
  }
}

export function readAttribution(): Attribution | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Attribution>;
    const source = clean(parsed.source);
    if (!source) return null;
    return { source, campaign: clean(parsed.campaign), referrer: clean(parsed.referrer) };
  } catch {
    return null;
  }
}
