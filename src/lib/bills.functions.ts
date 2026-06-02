import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ScanInput = z.object({
  imageBase64: z.string().min(100).max(15_000_000),
  mimeType: z.string().default("image/jpeg"),
});

const ScannedItemSchema = z.object({
  name: z.string(),
  canonical_name: z.string().default(""),
  brand: z.string().default("Local"),
  qty: z.coerce.number().default(1),
  unit: z.string().default("pcs"),
  unitPrice: z.coerce.number().default(0),
  price: z.coerce.number().default(0),
  sub: z.string().default("Other"),
  category: z.string().default("other"),
  category_id: z.string().nullable().default(null),
  subcategory_id: z.string().nullable().default(null),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
});

const ScannedBillSchema = z.object({
  store: z.string().default("Unknown"),
  date: z.string().optional(),
  category: z.string().default("other"),
  category_id: z.string().nullable().default(null),
  currency: z.string().default("INR"),
  country: z.string().default("IN"),
  locale: z.string().default("en-IN"),
  total: z.coerce.number().default(0),
  subtotal: z.coerce.number().default(0),
  tax: z.coerce.number().default(0),
  discount: z.coerce.number().default(0),
  items: z.array(ScannedItemSchema).default([]),
});

export type ScannedBill = z.infer<typeof ScannedBillSchema>;
export type ScannedItem = z.infer<typeof ScannedItemSchema>;

/** Build a compact taxonomy block for the AI prompt. */
async function loadTaxonomy() {
  const [{ data: cats, error: e1 }, { data: subs, error: e2 }] = await Promise.all([
    supabaseAdmin.from("categories").select("id, key, label").order("sort_order"),
    supabaseAdmin.from("subcategories").select("id, category_id, key, label, keywords").order("sort_order"),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  const categories = cats ?? [];
  const subcategories = subs ?? [];
  const catKeyById = new Map(categories.map((c) => [c.id, c.key]));
  const catIdByKey = new Map(categories.map((c) => [c.key, c.id]));
  const subIdByKeyByCat = new Map<string, Map<string, string>>();
  for (const s of subcategories) {
    const catKey = catKeyById.get(s.category_id) ?? "other";
    if (!subIdByKeyByCat.has(catKey)) subIdByKeyByCat.set(catKey, new Map());
    subIdByKeyByCat.get(catKey)!.set(s.key, s.id);
  }
  return { categories, subcategories, catIdByKey, subIdByKeyByCat };
}

function buildTaxonomyPrompt(
  categories: Array<{ key: string; label: string }>,
  subcategories: Array<{ category_id: string; key: string; label: string; keywords: string[] }>,
  catKeyById: Map<string, string>,
) {
  const subsByCat = new Map<string, Array<{ key: string; label: string; keywords: string[] }>>();
  for (const s of subcategories) {
    const catKey = catKeyById.get(s.category_id) ?? "other";
    if (!subsByCat.has(catKey)) subsByCat.set(catKey, []);
    subsByCat.get(catKey)!.push({ key: s.key, label: s.label, keywords: s.keywords ?? [] });
  }
  const lines: string[] = [];
  for (const c of categories) {
    const subs = subsByCat.get(c.key) ?? [];
    const subStr = subs.length
      ? subs.map((s) => `${s.key}(${s.label}${s.keywords.length ? `: ${s.keywords.slice(0, 6).join(",")}` : ""})`).join(" | ")
      : "—";
    lines.push(`• ${c.key} (${c.label}) → ${subStr}`);
  }
  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are a world-class bill/receipt parser used by an international household expense tracker.

You receive an image of a bill, receipt, or invoice from ANY country (India, US, EU, UK, etc.) and ANY domain — grocery, pharmacy, fuel station, restaurant, electronics, mobile phone, appliance, clothing, online order, utility bill, hotel, taxi, anything.

Read the image carefully and extract:
- The store/merchant name exactly as printed.
- The bill date (ISO 8601). If only partial, infer year.
- The ISO 4217 currency code (INR, USD, EUR, GBP, AED, JPY, …). Infer from the currency symbol (₹/Rs → INR, $ → USD, € → EUR, £ → GBP, ¥ → JPY, د.إ → AED, …) and context.
- ISO 3166 country code (IN, US, GB, DE, …) and a reasonable BCP-47 locale (en-IN, en-US, de-DE, …).
- subtotal, tax (GST/VAT/sales tax combined), discount, grand total.
- EVERY line item with: name, brand (real brand if visible, else "Local"), qty (number), unit (kg/g/L/ml/pcs/pack/bottle/strip/bar/plate/serving), unit_price, line price, a precise per-item category_key and subcategory_key from the taxonomy below, and a confidence 0..1.
- canonical_name for every line item: a short, lowercase, brand-agnostic identifier you would use to match the SAME product across receipts and stores. Examples: "dettol soap 125g", "amul milk 1l", "crocin 500", "iphone 15 case", "petrol", "lays classic 50g". Strip pack-of-N marketing; keep size when meaningful. NEVER blank.

CATEGORY TAXONOMY (use these exact keys — do NOT invent new ones):
{TAXONOMY}

Rules:
- Classify EACH line independently. A supermarket bill mixes grocery, dairy, produce, hygiene, household etc. — never copy the bill-level category onto every item.
- Match on item semantics, not just keywords. "Amul Taaza 500ml" → dairy/milk. "Surf Excel" → household/detergent. "Crocin" → medicine/painkiller. "iPhone 15 case" → mobile/accessory.
- If a subcategory does not clearly apply, omit subcategory_key (return "") and only set category_key.
- confidence: 0.95+ when obvious, 0.7-0.9 when reasonably sure, <0.6 when guessing.
- Never return an empty items array. Use your best judgement if text is partial.
- Currency MUST be a valid ISO 4217 code. Default INR only if truly ambiguous.`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "submit_parsed_bill",
    description: "Return the parsed bill in the required structured format.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        store: { type: "string" },
        date: { type: "string", description: "ISO 8601 date" },
        currency: { type: "string", description: "ISO 4217 code" },
        country: { type: "string", description: "ISO 3166 code" },
        locale: { type: "string", description: "BCP-47 locale" },
        category_key: { type: "string", description: "Dominant category key from taxonomy" },
        subtotal: { type: "number" },
        tax: { type: "number" },
        discount: { type: "number" },
        total: { type: "number" },
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              canonical_name: { type: "string", description: "Short brand-agnostic key to match the same product across stores. Lowercase. Always provided." },
              brand: { type: "string" },
              qty: { type: "number" },
              unit: { type: "string" },
              unit_price: { type: "number" },
              price: { type: "number" },
              category_key: { type: "string" },
              subcategory_key: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["name", "qty", "price", "category_key"],
          },
        },
      },
      required: ["store", "currency", "total", "items", "category_key"],
    },
  },
};

async function callGateway(body: unknown) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI gateway not configured");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (resp.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
  if (resp.status === 402) throw new Error("AI credits exhausted. Top up in Cloud → Usage.");
  if (!resp.ok) {
    const text = await resp.text();
    console.error("AI gateway failed", resp.status, text);
    throw new Error("AI service error. Please try again.");
  }
  return resp.json();
}

function extractToolArgs(json: unknown): unknown {
  const j = json as { choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }>; content?: string } }> };
  const tc = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (tc) {
    try { return JSON.parse(tc); } catch { /* fallthrough */ }
  }
  const content = j?.choices?.[0]?.message?.content ?? "";
  if (typeof content === "string") {
    try { return JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
    }
  }
  throw new Error("AI returned an unreadable response.");
}

export const scanBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScanInput.parse(input))
  .handler(async ({ data }) => {
    const tax = await loadTaxonomy();
    const catKeyById = new Map(tax.categories.map((c) => [c.id, c.key]));
    const prompt = SYSTEM_PROMPT.replace(
      "{TAXONOMY}",
      buildTaxonomyPrompt(tax.categories, tax.subcategories, catKeyById),
    );
    const dataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;

    const json = await callGateway({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Parse this bill. Call submit_parsed_bill with the result." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "function", function: { name: "submit_parsed_bill" } },
    });

    const args = extractToolArgs(json) as {
      store?: string;
      date?: string;
      currency?: string;
      country?: string;
      locale?: string;
      category_key?: string;
      subtotal?: number;
      tax?: number;
      discount?: number;
      total?: number;
      items?: Array<{
        name: string;
        brand?: string;
        qty?: number;
        unit?: string;
        unit_price?: number;
        price?: number;
        category_key?: string;
        subcategory_key?: string;
        confidence?: number;
      }>;
    };

    const billCatKey = (args.category_key && tax.catIdByKey.has(args.category_key)) ? args.category_key : "other";
    const billCatId = tax.catIdByKey.get(billCatKey) ?? null;

    const items = (args.items ?? []).map((it) => {
      const ck = it.category_key && tax.catIdByKey.has(it.category_key) ? it.category_key : "other";
      const sk = it.subcategory_key && tax.subIdByKeyByCat.get(ck)?.has(it.subcategory_key) ? it.subcategory_key : "";
      return {
        name: it.name,
        canonical_name: (it.canonical_name ?? "").toLowerCase().trim() || it.name.toLowerCase().trim(),
        brand: it.brand || "Local",
        qty: Number(it.qty ?? 1),
        unit: it.unit || "pcs",
        unitPrice: Number(it.unit_price ?? 0),
        price: Number(it.price ?? 0),
        sub: sk
          ? (tax.subcategories.find((s) => s.key === sk && catKeyById.get(s.category_id) === ck)?.label ?? "Other")
          : "Other",
        category: ck,
        category_id: tax.catIdByKey.get(ck) ?? null,
        subcategory_id: sk ? (tax.subIdByKeyByCat.get(ck)?.get(sk) ?? null) : null,
        confidence: Math.max(0, Math.min(1, Number(it.confidence ?? 0.7))),
      };
    });

    if (!items.length) throw new Error("No items detected on this bill. Try a clearer photo.");

    return ScannedBillSchema.parse({
      store: args.store ?? "Unknown",
      date: args.date,
      category: billCatKey,
      category_id: billCatId,
      currency: (args.currency ?? "INR").toUpperCase(),
      country: (args.country ?? "IN").toUpperCase(),
      locale: args.locale ?? "en-IN",
      total: Number(args.total ?? 0) || items.reduce((s, it) => s + it.price, 0),
      subtotal: Number(args.subtotal ?? 0),
      tax: Number(args.tax ?? 0),
      discount: Number(args.discount ?? 0),
      items,
    });
  });

/**
 * Re-classify legacy items that have no category_id (or low confidence)
 * using the same taxonomy + AI brain. Batched to keep latency + cost predictable.
 */
export const recategorizeMyItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const tax = await loadTaxonomy();
    const catKeyById = new Map(tax.categories.map((c) => [c.id, c.key]));

    const { data: items, error } = await supabaseAdmin
      .from("items")
      .select("id, name, brand, sub, category, category_id, categorized_by")
      .eq("user_id", userId)
      .or("category_id.is.null,categorized_by.eq.rule");

    if (error) throw new Error(error.message);
    const queue = (items ?? []).filter((i) => i.categorized_by !== "user");
    if (queue.length === 0) return { updated: 0, total: 0 };

    const taxonomyPrompt = buildTaxonomyPrompt(tax.categories, tax.subcategories, catKeyById);
    const BATCH = 40;
    let updated = 0;

    for (let i = 0; i < queue.length; i += BATCH) {
      const chunk = queue.slice(i, i + BATCH);
      const listing = chunk.map((it, idx) => `${idx + 1}. ${it.name} | brand=${it.brand ?? "Local"} | sub=${it.sub ?? ""}`).join("\n");

      const json = await callGateway({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a taxonomy classifier. Map each shopping item to a (category_key, subcategory_key) pair from this taxonomy. Output JSON only.\n\n${taxonomyPrompt}`,
          },
          {
            role: "user",
            content: `Classify these items. Reply by calling classify_items.\n${listing}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "classify_items",
            description: "Return one classification per input line in order.",
            parameters: {
              type: "object",
              additionalProperties: false,
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      index: { type: "integer" },
                      category_key: { type: "string" },
                      subcategory_key: { type: "string" },
                      confidence: { type: "number", minimum: 0, maximum: 1 },
                    },
                    required: ["index", "category_key"],
                  },
                },
              },
              required: ["results"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "classify_items" } },
      });

      const args = extractToolArgs(json) as {
        results?: Array<{ index: number; category_key: string; subcategory_key?: string; confidence?: number }>;
      };

      for (const r of args.results ?? []) {
        const item = chunk[r.index - 1];
        if (!item) continue;
        const ck = tax.catIdByKey.has(r.category_key) ? r.category_key : "other";
        const cid = tax.catIdByKey.get(ck) ?? null;
        const sk = r.subcategory_key && tax.subIdByKeyByCat.get(ck)?.has(r.subcategory_key) ? r.subcategory_key : "";
        const sid = sk ? (tax.subIdByKeyByCat.get(ck)?.get(sk) ?? null) : null;
        const subLabel = sk
          ? (tax.subcategories.find((s) => s.key === sk && catKeyById.get(s.category_id) === ck)?.label ?? item.sub)
          : item.sub;

        const { error: upErr } = await supabaseAdmin
          .from("items")
          .update({
            category: ck,
            category_id: cid,
            subcategory_id: sid,
            sub: subLabel,
            category_confidence: Math.max(0, Math.min(1, Number(r.confidence ?? 0.8))),
            categorized_by: "ai",
            categorized_at: new Date().toISOString(),
          })
          .eq("id", item.id)
          .eq("user_id", userId);
        if (!upErr) updated++;
      }
    }

    return { updated, total: queue.length };
  });