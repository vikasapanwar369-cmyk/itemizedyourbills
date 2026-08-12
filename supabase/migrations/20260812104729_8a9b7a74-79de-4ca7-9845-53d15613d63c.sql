DROP POLICY IF EXISTS "own bills update" ON public.bills;
CREATE POLICY "own bills update" ON public.bills FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own items update" ON public.items;
CREATE POLICY "own items update" ON public.items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own recurring bills" ON public.recurring_bills;
CREATE POLICY "Users manage own recurring bills" ON public.recurring_bills FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);