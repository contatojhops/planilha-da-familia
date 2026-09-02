-- =====================================================================
-- SEGURANÇA: isolar funções de convite apenas para usuários autenticados
-- =====================================================================

revoke execute on function public.create_family_invite(uuid, text, public.family_role) from public, anon;
revoke execute on function public.accept_family_invite(uuid) from public, anon;
revoke execute on function public.revoke_family_invite(uuid) from public, anon;

grant execute on function public.create_family_invite(uuid, text, public.family_role) to authenticated;
grant execute on function public.accept_family_invite(uuid) to authenticated;
grant execute on function public.revoke_family_invite(uuid) to authenticated;
