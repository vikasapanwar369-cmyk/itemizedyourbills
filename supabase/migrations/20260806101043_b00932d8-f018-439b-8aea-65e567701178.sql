CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My Household',
  owner_id uuid NOT NULL,
  invite_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.household_members (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL PRIMARY KEY,
  role text NOT NULL DEFAULT 'member',
  display_name text,
  joined_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX household_members_household_idx ON public.household_members(household_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.households TO authenticated;
GRANT ALL ON public.households TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_members TO authenticated;
GRANT ALL ON public.household_members TO service_role;

CREATE OR REPLACE FUNCTION public.household_id_of(_user uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id FROM public.household_members WHERE user_id = _user
$$;

CREATE OR REPLACE FUNCTION public.shares_household(_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _owner = auth.uid()
    OR (
      public.household_id_of(auth.uid()) IS NOT NULL
      AND public.household_id_of(_owner) = public.household_id_of(auth.uid())
    )
$$;

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view household" ON public.households FOR SELECT TO authenticated
  USING (id = public.household_id_of(auth.uid()));
CREATE POLICY "owner creates household" ON public.households FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner updates household" ON public.households FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner deletes household" ON public.households FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "members view members" ON public.household_members FOR SELECT TO authenticated
  USING (household_id = public.household_id_of(auth.uid()));
CREATE POLICY "self joins membership" ON public.household_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "self updates membership" ON public.household_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "self or owner removes membership" ON public.household_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.households h WHERE h.id = household_id AND h.owner_id = auth.uid())
  );

CREATE POLICY "household views bills" ON public.bills FOR SELECT TO authenticated
  USING (public.shares_household(user_id));
CREATE POLICY "household views items" ON public.items FOR SELECT TO authenticated
  USING (public.shares_household(user_id));
CREATE POLICY "household views budgets" ON public.budgets FOR SELECT TO authenticated
  USING (public.shares_household(user_id));
CREATE POLICY "household views shopping" ON public.shopping_list_items FOR SELECT TO authenticated
  USING (public.shares_household(user_id));
CREATE POLICY "household views recurring" ON public.recurring_bills FOR SELECT TO authenticated
  USING (public.shares_household(user_id));

CREATE TRIGGER households_updated_at BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();