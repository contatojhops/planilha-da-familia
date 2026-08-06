revoke execute on function public.touch_updated_at() from anon, authenticated;
revoke execute on function public.log_tx_audit() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.seed_default_categories() from anon, authenticated;
revoke execute on function public.is_family_member(uuid) from anon;
revoke execute on function public.family_role_of(uuid) from anon;
revoke execute on function public.can_write(uuid) from anon;
revoke execute on function public.is_family_admin(uuid) from anon;