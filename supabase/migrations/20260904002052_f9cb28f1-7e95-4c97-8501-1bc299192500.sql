REVOKE EXECUTE ON FUNCTION public.can_write(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.family_role_of(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_family_admin(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_family_member(uuid) FROM authenticated;

-- Funções chamadas pelo front permanecem acessíveis:
-- accept_family_invite, create_family_with_owner, create_family_invite, revoke_family_invite, pay_card_invoice
