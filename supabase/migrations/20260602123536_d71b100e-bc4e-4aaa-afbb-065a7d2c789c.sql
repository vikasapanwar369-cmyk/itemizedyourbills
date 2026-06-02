ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS image_phash text,
  ADD COLUMN IF NOT EXISTS content_hash text;

CREATE INDEX IF NOT EXISTS bills_user_phash_idx ON public.bills(user_id, image_phash);
CREATE INDEX IF NOT EXISTS bills_user_content_idx ON public.bills(user_id, content_hash);

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS canonical_name text;

CREATE INDEX IF NOT EXISTS items_user_canonical_idx ON public.items(user_id, canonical_name);
CREATE INDEX IF NOT EXISTS items_user_billdate_idx ON public.items(user_id, bill_date DESC);