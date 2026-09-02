-- =====================================================================
-- SEGURANÇA: revogar execução anônima nas funções de convite
-- =====================================================================

revoke execute on function public.create_family_invite(uuid, text, public.family_role) from anon;
revoke execute on function public.accept_family_invite(uuid) from anon;
revoke execute on function public.revoke_family_invite(uuid) from anon;

-- Garante acesso para usuários autenticados (já concedido na migration anterior,
-- mas mantido aqui para deixar explícito).
grant execute on function public.create_family_invite(uuid, text, public.family_role) to authenticated;
grant execute on function public.accept_family_invite(uuid) to authenticated;
grant execute on function public.revoke_family_invite(uuid) to authenticated;
