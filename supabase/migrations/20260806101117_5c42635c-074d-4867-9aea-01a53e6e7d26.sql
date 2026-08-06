REVOKE ALL ON FUNCTION public.household_id_of(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shares_household(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.household_id_of(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shares_household(uuid) TO authenticated, service_role;