-- =====================================================================
-- Ajusta accept_family_invite para receber nome de exibição opcional
-- =====================================================================

create or replace function public.accept_family_invite(
  p_token uuid,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invitations;
  v_member_id uuid;
begin
  select * into v_invite
  from public.invitations
  where token = p_token
    and status = 'pending'
    and expires_at > now();

  if v_invite is null then
    raise exception 'Convite inválido ou expirado';
  end if;

  insert into public.family_members (family_id, user_id, role)
  values (v_invite.family_id, auth.uid(), v_invite.role)
  returning id into v_member_id;

  update public.invitations
  set status = 'accepted', accepted_at = now()
  where id = v_invite.id;

  if nullif(btrim(p_display_name), '') is not null then
    update public.profiles
    set full_name = btrim(p_display_name), updated_at = now()
    where id = auth.uid();
  end if;

  return v_invite.family_id;
end;
$$;

grant execute on function public.accept_family_invite(uuid, text) to authenticated;
revoke execute on function public.accept_family_invite(uuid, text) from anon;
revoke execute on function public.accept_family_invite(uuid, text) from public;
