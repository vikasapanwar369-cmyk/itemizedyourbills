import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ScanInput = z.object({
  imageBase64: z.string().min(100).max(15_000_000),
  mimeType: z.string().default("image/jpeg"),
});

const CATEGORIES = [
  "grocery", "vegetable", "dairy", "hygiene", "household",
  "medicine", "petrol", "clothes", "electric", "restaurant",
  "school", "utility", "other",
] as const;

const ItemSchema = z.object({
  name: z.string(),
  brand: z.string().default("Local"),
  qty: z.coerce.number().default(1),
  unit: z.string().default("pcs"),
  unitPrice: z.coerce.number().default(0),
  price: z.coerce.number().default(0),
  sub: z.string().default("Other"),
  category: z.enum(CATEGORIES).default("other"),
});

const BillSchema = z.object({
  store: z.string().default("Unknown"),
  date: z.string().optional(),
  category: z.enum(CATEGORIES).default("other"),
  total: z.coerce.number().default(0),
  items: z.array(ItemSchema).default([]),
});

export type ScannedBill = z.infer<typeof BillSchema>;

const SYSTEM_PROMPT = `You are a bill scanner for an Indian household expense tracker.
Carefully read this bill image and extract every line item.
Return ONLY a valid JSON object with this exact structure:
{
  "store": "exact store name from bill",
  "date": "ISO 8601 date if visible, else today",
  "category": "DOMINANT category for the whole bill: grocery|vegetable|dairy|hygiene|household|medicine|petrol|clothes|electric|restaurant|school|utility|other",
  "total": <number>,
  "items": [
    {
      "name": "item name",
      "brand": "brand name or Local",
      "qty": <number>,
      "unit": "kg|g|L|ml|pcs|bars|strips|bottles|pack|plate",
      "unitPrice": <number>,
      "price": <line total>,
      "sub": "Daal|Cooking Oil|Bathing Soap|Shampoo|Petrol|Vitamin|Fever & Pain|Rice & Wheat|Spices|Daily Vegetables|Leafy Greens|Seasonal Fruits|Meal|Starter|Shirt|Trouser|Innerwear|Milk|Paneer|Curd|Butter|Ghee|Atta|Sugar|Salt|etc",
      "category": "PER-ITEM category from the same list above. Classify EACH item individually like Amazon/Flipkart taxonomy. Examples: milk/paneer/curd/butter/ghee/cheese -> dairy; fresh vegetables/fruits -> vegetable; soap/shampoo/toothpaste/sanitary -> hygiene; broom/detergent/cleaner/utensils -> household; tablets/medicines/syrup -> medicine; atta/rice/daal/sugar/salt/spices/oil/snacks -> grocery."
    }
  ]
}
Rules:
- Extract every visible item.
- Use actual brand names (Amul, Tata, Dettol, Surf Excel, Parachute, MDH, Fortune, Colgate etc).
- qty is always a number, unit is the string.
- ALWAYS set a precise per-item "category" — do NOT just copy the bill category. A grocery-store bill can contain dairy, hygiene, household and grocery items; categorise each line correctly.
- If unclear, make your best estimate. Never return an empty items array.
- Output ONLY the JSON object, no prose, no markdown fences.`;

export const scanBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScanInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");

    const dataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract every line item from this bill. Return ONLY the JSON object." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) {
      throw new Error("Rate limit reached. Please try again in a moment.");
    }
    if (resp.status === 402) {
      throw new Error("AI credits exhausted. Please top up in Cloud → Usage.");
    }
    if (!resp.ok) {
      const text = await resp.text();
      console.error("AI scan failed", resp.status, text);
      throw new Error("Could not read the bill. Please try a clearer photo.");
    }

    const json = await resp.json();
    const raw = json?.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      const match = String(raw).match(/\{[\s\S]*\}/);
      if (!match) throw new Error("AI returned an unreadable response. Try again.");
      parsed = JSON.parse(match[0]);
    }
    const bill = BillSchema.parse(parsed);
    if (!bill.items.length) {
      throw new Error("No items detected on this bill. Try a clearer photo.");
    }
    return bill;
  });