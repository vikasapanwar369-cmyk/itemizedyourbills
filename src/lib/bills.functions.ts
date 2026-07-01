import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ScanInput = z.object({
  imageBase64: z.string().min(100).max(15_000_000),
  mimeType: z
    .enum(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"])
    .default("image/jpeg"),
});

const ScannedItemSchema = z.object({
  name: z.string(),
  canonical_name: z.string().default(""),
  brand: z.string().default("Local"),
  company: z.string().nullable().default(null),
  qty: z.coerce.number().default(1),
  unit: z.string().default("pcs"),
  unit_weight_or_volume: z.string().nullable().default(null),
  mrp: z.coerce.number().nullable().default(null),
  unitPrice: z.coerce.number().default(0),
  price: z.coerce.number().default(0),
  discount: z.coerce.number().default(0),
  gst_percent: z.coerce.number().nullable().default(null),
  sub: z.string().default("Other"),
  category: z.string().default("other"),
  category_id: z.string().nullable().default(null),
  subcategory_id: z.string().nullable().default(null),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
});

const ScannedBillSchema = z.object({
  store: z.string().default("Unknown"),
  date: z.string().optional(),
  time: z.string().nullable().default(null),
  bill_number: z.string().nullable().default(null),
  merchant_address: z.string().nullable().default(null),
  category: z.string().default("other"),
  category_id: z.string().nullable().default(null),
  currency: z.string().default("INR"),
  country: z.string().default("IN"),
  locale: z.string().default("en-IN"),
  total: z.coerce.number().default(0),
  subtotal: z.coerce.number().default(0),
  tax: z.coerce.number().default(0),
  discount: z.coerce.number().default(0),
  payment_mode: z.string().default("unknown"),
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

const SYSTEM_PROMPT = `You are BillSnap, an expert Indian household bill parser. Your job is to analyze a photo of a purchase receipt or bill and extract every detail with extreme precision.

Your output MUST always be a valid JSON object — nothing else. No explanation, no markdown, no extra text. Just raw JSON.

Extract the following for EVERY single line item on the bill:
- name: Clean product name (e.g., Lux Soap, Tata Salt, Crocin 500mg, Amul Milk)
- brand: Brand name (e.g., Lux, Tata, Amul) or null
- company: Parent manufacturer (e.g., HUL, Tata Consumer Products, Amul) or null
- category: One of — Grocery, Produce, Dairy, Beverages, Snacks, Bakery, Household, Hygiene, Beauty, Medicine, Salon, Doctor, Appliances, Electronics, Mobile, Clothing, Footwear, Furniture, Stationery, Baby, Pets, Restaurant, Fuel, Utility, Transport, Travel, Entertainment, Sports, Services, Jewelry, Other
- sub_category: A short e-commerce style path "Parent > Child" — e.g. "Personal Care > Hair Styling" (salon), "Electronics > Kitchen Appliances" (appliances), "Health > Consultation" (doctor), "Grocery > Cooking Oil", "Dairy > Butter"
- quantity: Number of units bought (integer, default 1)
- unit: pcs or kg or g or L or ml or pack or dozen or pair
- unit_weight_or_volume: Weight or volume of ONE unit as string like 125g or 500ml or 1kg or null
- mrp: Maximum Retail Price per unit if shown on bill, else null
- unit_price: Actual selling price per unit after any discount (number)
- discount: Discount on this item in rupees, use 0 if none
- total_price: Total amount charged for this item (number)
- gst_percent: GST percentage on this item if shown, else null

Also extract this bill-level info:
- bill_date: Date in YYYY-MM-DD format
- bill_time: Time in HH:MM 24hr format or null
- bill_number: Invoice number if printed or null
- merchant_name: Shop or store name like D-Mart or Apollo Pharmacy or Sharma Medical
- merchant_address: Store address if printed or null
- payment_mode: cash or upi or card or unknown
- grand_total: Final total amount paid (number)
- total_discount: Total discount on whole bill (number, 0 if none)
- total_tax: Total GST or tax amount if shown or null

RULES:
- Return ONLY valid JSON. No markdown. No explanation text.
- If a field cannot be read from the image use null — never guess randomly
- For loose items like Tomato 500g at 30 rupees per kg, calculate correctly: unit_weight_or_volume is 500g, unit_price is 15, total_price is 15
- Merge duplicate line items into one with combined quantity`;

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

function extractJsonContent(json: unknown): unknown {
  const j = json as { choices?: Array<{ message?: { content?: string } }> };
  const content = j?.choices?.[0]?.message?.content ?? "";
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI returned an empty response.");
  }
  try { return JSON.parse(content); } catch { /* try to recover */ }
  const m = content.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch { /* noop */ }
  }
  throw new Error("AI returned an unreadable response.");
}

export const scanBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScanInput.parse(input))
  .handler(async ({ data }) => {
    const tax = await loadTaxonomy();
    // Match the user's fixed category enum (label) to our taxonomy rows by label/key.
    const catIdByLabel = new Map(tax.categories.map((c) => [c.label.toLowerCase(), c.id]));
    const catKeyByLabel = new Map(tax.categories.map((c) => [c.label.toLowerCase(), c.key]));
    const dataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;

    const json = await callGateway({
      model: "google/gemini-2.5-pro",
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Parse this bill. Return ONLY raw JSON as specified." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const parsed = extractJsonContent(json) as {
      bill_date?: string;
      bill_time?: string | null;
      bill_number?: string | null;
      merchant_name?: string;
      merchant_address?: string | null;
      payment_mode?: string;
      grand_total?: number;
      total_discount?: number;
      total_tax?: number | null;
      currency?: string;
      country?: string;
      locale?: string;
      subtotal?: number;
      tax?: number;
      discount?: number;
      items?: Array<{
        name: string;
        brand?: string | null;
        company?: string | null;
        category?: string;
        sub_category?: string;
        quantity?: number;
        unit?: string;
        unit_weight_or_volume?: string | null;
        mrp?: number | null;
        unit_price?: number;
        discount?: number;
        total_price?: number;
        gst_percent?: number | null;
      }>;
    };

    const resolveCat = (label?: string) => {
      const l = (label ?? "").toLowerCase().trim();
      const key = catKeyByLabel.get(l) ?? "other";
      const id = catIdByLabel.get(l) ?? tax.catIdByKey.get("other") ?? null;
      return { key, id, label: label || "Other" };
    };

    const items = (parsed.items ?? []).map((it) => {
      const cat = resolveCat(it.category);
      const qty = Number(it.quantity ?? 1) || 1;
      const total = Number(it.total_price ?? 0);
      const unitPrice = Number(it.unit_price ?? (qty > 0 ? total / qty : 0));
      return {
        name: it.name,
        canonical_name: (it.name ?? "").toLowerCase().trim(),
        brand: it.brand || "Local",
        company: it.company ?? null,
        qty,
        unit: it.unit || "pcs",
        unit_weight_or_volume: it.unit_weight_or_volume ?? null,
        mrp: it.mrp == null ? null : Number(it.mrp),
        unitPrice,
        price: total,
        discount: Number(it.discount ?? 0) || 0,
        gst_percent: it.gst_percent == null ? null : Number(it.gst_percent),
        sub: it.sub_category || "Other",
        category: cat.key,
        category_id: cat.id,
        subcategory_id: null as string | null,
        confidence: 0.9,
      };
    });

    // Dominant category across items
    const counts = new Map<string, number>();
    for (const it of items) counts.set(it.category, (counts.get(it.category) ?? 0) + 1);
    const billCatKey = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "other";
    const billCatId = tax.catIdByKey.get(billCatKey) ?? null;

    if (!items.length) throw new Error("No items detected on this bill. Try a clearer photo.");

    return ScannedBillSchema.parse({
      store: parsed.merchant_name ?? "Unknown",
      date: parsed.bill_date,
      time: parsed.bill_time ?? null,
      bill_number: parsed.bill_number ?? null,
      merchant_address: parsed.merchant_address ?? null,
      category: billCatKey,
      category_id: billCatId,
      currency: (parsed.currency ?? "INR").toUpperCase(),
      country: (parsed.country ?? "IN").toUpperCase(),
      locale: parsed.locale ?? "en-IN",
      total: Number(parsed.grand_total ?? 0) || items.reduce((s, it) => s + it.price, 0),
      subtotal: Number(parsed.subtotal ?? 0),
      tax: Number(parsed.total_tax ?? parsed.tax ?? 0),
      discount: Number(parsed.total_discount ?? parsed.discount ?? 0),
      payment_mode: (parsed.payment_mode ?? "unknown").toLowerCase(),
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

/**
 * Look up an existing bill that matches by image fingerprint OR content fingerprint.
 * Returns the first match so the UI can warn the user before they double-save.
 */
export const checkDuplicateBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      imagePhash: z.string().optional(),
      contentHash: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const hashes: string[] = [];
    if (data.imagePhash) hashes.push(`image_phash.eq.${data.imagePhash}`);
    if (data.contentHash) hashes.push(`content_hash.eq.${data.contentHash}`);
    if (hashes.length === 0) return { found: null as null | { id: string; store: string; bill_date: string; total: number; currency: string } };

    const { data: rows, error } = await supabaseAdmin
      .from("bills")
      .select("id, store, bill_date, total, currency")
      .eq("user_id", userId)
      .or(hashes.join(","))
      .order("bill_date", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return { found: rows?.[0] ?? null };
  });