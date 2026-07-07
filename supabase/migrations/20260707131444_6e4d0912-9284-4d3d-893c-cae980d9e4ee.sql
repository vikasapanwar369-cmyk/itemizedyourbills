
CREATE TABLE public.recurring_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  store text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  cadence_days integer NOT NULL DEFAULT 30,
  avg_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending',
  next_due_date timestamptz,
  last_seen_date timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key),
  CHECK (status IN ('pending','confirmed','disabled'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_bills TO authenticated;
GRANT ALL ON public.recurring_bills TO service_role;

ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own recurring bills"
  ON public.recurring_bills FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_recurring_bills_updated_at
  BEFORE UPDATE ON public.recurring_bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enforce duplicate-bill prevention at the database level
CREATE UNIQUE INDEX IF NOT EXISTS bills_user_image_phash_uniq
  ON public.bills (user_id, image_phash)
  WHERE image_phash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bills_user_content_hash_uniq
  ON public.bills (user_id, content_hash)
  WHERE content_hash IS NOT NULL;
