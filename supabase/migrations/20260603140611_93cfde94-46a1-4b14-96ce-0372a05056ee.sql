
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS mrp numeric,
  ADD COLUMN IF NOT EXISTS gst_percent numeric,
  ADD COLUMN IF NOT EXISTS unit_weight_or_volume text;

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'unknown';

CREATE INDEX IF NOT EXISTS items_user_billdate_idx ON public.items (user_id, bill_date DESC);
CREATE INDEX IF NOT EXISTS items_user_category_idx ON public.items (user_id, category);
