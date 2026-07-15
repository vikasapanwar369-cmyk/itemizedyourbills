DROP POLICY IF EXISTS "own items update" ON public.items;
CREATE POLICY "own items update" ON public.items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own bills update" ON public.bills;
CREATE POLICY "own bills update" ON public.bills FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);