DROP FUNCTION IF EXISTS public.accept_family_invite(uuid);

CREATE OR REPLACE FUNCTION public.accept_family_invite(p_token uuid, p_display_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_invite public.invitations;
  v_member_id uuid;
  v_uid uuid := auth.uid();
begin
  select * into v_invite
  from public.invitations
  where token = p_token::text
    and status = 'pending'
    and expires_at > now();

  if v_invite is null then
    raise exception 'Convite inválido ou expirado';
  end if;

  insert into public.family_members (family_id, user_id, role)
  values (v_invite.family_id, v_uid, v_invite.role)
  returning id into v_member_id;

  update public.invitations
  set status = 'accepted', accepted_at = now()
  where id = v_invite.id;

  if nullif(btrim(p_display_name), '') is not null then
    update public.profiles
      set full_name = btrim(p_display_name)
    where id = v_uid and coalesce(btrim(full_name), '') = '';
  end if;

  return v_invite.family_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.accept_family_invite(uuid, text) TO authenticated;
