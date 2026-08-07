create or replace function public.create_family_with_owner(
  p_family_name text,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.families (name, created_by)
  values (coalesce(nullif(btrim(p_family_name), ''), 'Minha família'), v_uid)
  returning id into v_family_id;

  insert into public.family_members (family_id, user_id, role)
  values (v_family_id, v_uid, 'admin')
  on conflict do nothing;

  if nullif(btrim(p_display_name), '') is not null then
    update public.profiles
      set full_name = btrim(p_display_name)
    where id = v_uid and coalesce(btrim(full_name), '') = '';
  end if;

  return v_family_id;
end;
$$;

revoke all on function public.create_family_with_owner(text, text) from public;
grant execute on function public.create_family_with_owner(text, text) to authenticated;