/**
 * Single source of truth for every contact detail BillSnap publishes.
 *
 * These values appear on the privacy notice, the help screen and the support
 * tools console. Fill each one in once and every screen picks it up — there are
 * no addresses hardcoded anywhere else in the app.
 *
 * IMPORTANT: never publish a placeholder as if it were real. The screens below
 * hide or clearly mark anything that is still blank, so an unreachable mailbox
 * can never be shown to a user as an official grievance channel.
 */
export const SUPPORT_CONFIG = {
  brand: "BillSnap",

  /**
   * Grievance Officer under the DPDP Act, 2023 (Sec. 13). Must be a real,
   * named, reachable person plus a postal address.
   */
  grievanceOfficer: {
    name: "",
    email: "",
    address: "",
  },

  /** Where a support message actually lands — an inbox you check daily. */
  supportInbox: "",

  /** WhatsApp Business number, international format, digits only (e.g. 919812345678). */
  whatsappNumber: "",

  /** The promise the help screen makes. Only shorten it if you can keep it. */
  responsePromise: "We reply to every message within 1 business day.",
  grievancePromise: "Grievances are acknowledged within 48 hours and resolved within 7 days.",
} as const;

/** True only when every Grievance Officer field is a real value. */
export function grievanceOfficerPublished(): boolean {
  const o = SUPPORT_CONFIG.grievanceOfficer;
  return Boolean(o.name.trim() && o.email.trim() && o.address.trim());
}

/** mailto: for the support inbox, or null when no real inbox is set. */
export function supportMailto(subject: string): string | null {
  const inbox = SUPPORT_CONFIG.supportInbox.trim();
  if (!inbox || !inbox.includes("@")) return null;
  return `mailto:${inbox}?subject=${encodeURIComponent(subject)}`;
}

/** wa.me link for the configured WhatsApp number, or null when it is blank. */
export function whatsappHref(message: string): string | null {
  const digits = SUPPORT_CONFIG.whatsappNumber.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
