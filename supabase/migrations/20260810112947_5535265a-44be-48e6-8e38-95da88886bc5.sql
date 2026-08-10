CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION private.household_id_of(_user uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT household_id FROM public.household_members WHERE user_id = _user $$;

CREATE OR REPLACE FUNCTION private.shares_household(_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT _owner = auth.uid()
  OR (private.household_id_of(auth.uid()) IS NOT NULL
      AND private.household_id_of(_owner) = private.household_id_of(auth.uid())) $$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.household_id_of(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.shares_household(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.household_id_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.shares_household(uuid) TO authenticated;

DROP POLICY IF EXISTS "household views bills" ON public.bills;
CREATE POLICY "household views bills" ON public.bills FOR SELECT TO authenticated USING (private.shares_household(user_id));

DROP POLICY IF EXISTS "household views items" ON public.items;
CREATE POLICY "household views items" ON public.items FOR SELECT TO authenticated USING (private.shares_household(user_id));

DROP POLICY IF EXISTS "household views budgets" ON public.budgets;
CREATE POLICY "household views budgets" ON public.budgets FOR SELECT TO authenticated USING (private.shares_household(user_id));

DROP POLICY IF EXISTS "household views shopping" ON public.shopping_list_items;
CREATE POLICY "household views shopping" ON public.shopping_list_items FOR SELECT TO authenticated USING (private.shares_household(user_id));

DROP POLICY IF EXISTS "household views recurring" ON public.recurring_bills;
CREATE POLICY "household views recurring" ON public.recurring_bills FOR SELECT TO authenticated USING (private.shares_household(user_id));

DROP POLICY IF EXISTS "members view members" ON public.household_members;
CREATE POLICY "members view members" ON public.household_members FOR SELECT TO authenticated USING (household_id = private.household_id_of(auth.uid()));

DROP POLICY IF EXISTS "members view household" ON public.households;
CREATE POLICY "members view household" ON public.households FOR SELECT TO authenticated USING (id = private.household_id_of(auth.uid()));

DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP FUNCTION IF EXISTS public.shares_household(uuid);
DROP FUNCTION IF EXISTS public.household_id_of(uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);