INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users ORDER BY created_at ASC LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;