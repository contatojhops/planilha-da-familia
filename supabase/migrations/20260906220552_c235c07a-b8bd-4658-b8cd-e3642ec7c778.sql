-- =====================================================================
-- FIX COMPLETO DO FLUXO DE CONVITES
-- =====================================================================

-- 1) A coluna que faltava — front-end e funções já assumiam que ela
--    existia, mas ela nunca foi criada na tabela.
alter table public.invitations
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked'));

-- Backfill: convites que já foram aceitos (accepted_at preenchido)
-- não devem ficar marcados como 'pending'.
update public.invitations
set status = 'accepted'
where accepted_at is not null and status = 'pending';

-- 2) create_family_invite — token é `text`, não `uuid`
drop function if exists public.create_family_invite(uuid, text, public.family_role);
create or replace function public.create_family_invite(
  p_family_id uuid,
  p_email text,
  p_role public.family_role
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not public.is_family_admin(p_family_id) then
    raise exception 'Somente administradores podem convidar membros';
  end if;

  insert into public.invitations (family_id, email, role, invited_by)
  values (p_family_id, p_email, p_role, auth.uid())
  returning token into v_token;

  return v_token;
end;
$$;

-- 3) accept_family_invite — mesmo problema de tipo no parâmetro do token
drop function if exists public.accept_family_invite(text);
drop function if exists public.accept_family_invite(uuid, text);
create or replace function public.accept_family_invite(
  p_token text,
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

  return v_invite.family_id;
end;
$$;

-- 4) Ajusta as permissões para os novos tipos de parâmetro
grant execute on function public.create_family_invite(uuid, text, public.family_role) to authenticated;
revoke execute on function public.create_family_invite(uuid, text, public.family_role) from anon, public;

grant execute on function public.accept_family_invite(text, text) to authenticated;
revoke execute on function public.accept_family_invite(text, text) from anon, public;