drop trigger if exists on_auth_user_created_first_admin on auth.users;
drop function if exists public.handle_first_admin();
comment on table public.products is 'DEPRECATED: prices come from the HyperTV API';
comment on table public.user_roles is 'DEPRECATED: no accounts in the shop';