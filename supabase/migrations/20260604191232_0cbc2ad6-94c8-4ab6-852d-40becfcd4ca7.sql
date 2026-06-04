
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS bill_time text,
  ADD COLUMN IF NOT EXISTS bill_number text,
  ADD COLUMN IF NOT EXISTS merchant_address text;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0;
