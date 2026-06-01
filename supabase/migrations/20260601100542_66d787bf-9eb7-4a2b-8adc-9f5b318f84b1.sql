
-- Bills table
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store TEXT NOT NULL DEFAULT 'Unknown',
  bill_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  category TEXT NOT NULL DEFAULT 'other',
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bills_user_date_idx ON public.bills(user_id, bill_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO authenticated;
GRANT ALL ON public.bills TO service_role;

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bills select" ON public.bills FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own bills insert" ON public.bills FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own bills update" ON public.bills FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own bills delete" ON public.bills FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Items table
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT 'Local',
  qty NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'pcs',
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sub TEXT NOT NULL DEFAULT 'Other',
  category TEXT NOT NULL DEFAULT 'other',
  bill_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX items_user_idx ON public.items(user_id);
CREATE INDEX items_bill_idx ON public.items(bill_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own items select" ON public.items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own items insert" ON public.items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own items update" ON public.items FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own items delete" ON public.items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Storage bucket for bill images
INSERT INTO storage.buckets (id, name, public) VALUES ('bill-images', 'bill-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "bill images read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'bill-images');
CREATE POLICY "bill images insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bill-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "bill images delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bill-images' AND auth.uid()::text = (storage.foldername(name))[1]);
