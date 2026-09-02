-- =====================================================================
-- BASE PARA FAMÍLIA, RELATÓRIOS E AJUSTES (adaptada ao schema Casa Clara)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Convites: adicionar status para acompanhar pendente/aceito/revogado
-- ---------------------------------------------------------------------
alter table public.invitations
  add column if not exists status text not null default 'pending';

-- ---------------------------------------------------------------------
-- 2) RLS na tabela de convites (invitations)
-- ---------------------------------------------------------------------
drop policy if exists "admin manages invites" on public.invitations;
create policy "admin manages invites" on public.invitations
  for all to authenticated
  using (public.is_family_admin(family_id))
  with check (public.is_family_admin(family_id));

drop policy if exists "anyone with the token can read the invite" on public.invitations;
create policy "anyone with the token can read the invite" on public.invitations
  for select using (status = 'pending' and expires_at > now());

-- ---------------------------------------------------------------------
-- 3) RLS: membro comum pode editar a própria linha em family_members
-- ---------------------------------------------------------------------
drop policy if exists "member updates own row" on public.family_members;
create policy "member updates own row" on public.family_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 4) Funções para criar, aceitar e revogar convites
-- ---------------------------------------------------------------------
create or replace function public.create_family_invite(
  p_family_id uuid,
  p_email text,
  p_role public.family_role
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
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

create or replace function public.accept_family_invite(p_token uuid)
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

create or replace function public.revoke_family_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invitations
  set status = 'revoked'
  where id = p_invite_id
    and public.is_family_admin(family_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 5) Relatório: orçado vs. realizado por categoria (para um mês)
-- ---------------------------------------------------------------------
create or replace function public.category_budget_vs_actual(
  p_family_id uuid,
  p_month date
)
returns table (
  category_id uuid,
  category_name text,
  kind public.category_kind,
  monthly_budget numeric,
  actual_amount numeric,
  percent_used numeric
)
language sql
stable
set search_path = public
as $$
  select
    c.id,
    c.name,
    c.kind,
    c.monthly_budget,
    coalesce(sum(t.amount), 0) as actual_amount,
    case
      when c.monthly_budget > 0 then
        round((coalesce(sum(t.amount), 0) / c.monthly_budget) * 100, 1)
      else null
    end as percent_used
  from public.categories c
  left join public.transactions t
    on t.category_id = c.id
    and t.status = 'realized'
    and date_trunc('month', t.tx_date) = date_trunc('month', p_month)
  where c.family_id = p_family_id
  group by c.id, c.name, c.kind, c.monthly_budget
  order by c.kind, actual_amount desc;
$$;

-- ---------------------------------------------------------------------
-- 6) Relatório: histórico mensal realizado
-- ---------------------------------------------------------------------
create or replace function public.historical_monthly_actuals(
  p_family_id uuid,
  p_months_back int default 12,
  p_member_id uuid default null
)
returns table (
  month_ref date,
  total_income numeric,
  total_expense numeric,
  net_balance numeric
)
language sql
stable
set search_path = public
as $$
  with months as (
    select date_trunc('month', current_date - (n || ' months')::interval)::date as month_ref
    from generate_series(0, p_months_back - 1) as n
  ),
  agg as (
    select
      date_trunc('month', t.tx_date)::date as month_ref,
      sum(case when t.type = 'income' then t.amount else 0 end) as total_income,
      sum(case when t.type = 'expense' then t.amount else 0 end) as total_expense
    from public.transactions t
    where t.family_id = p_family_id
      and t.status = 'realized'
      and (p_member_id is null or t.owner_id = p_member_id)
    group by 1
  )
  select
    m.month_ref,
    coalesce(a.total_income, 0),
    coalesce(a.total_expense, 0),
    coalesce(a.total_income, 0) - coalesce(a.total_expense, 0)
  from months m
  left join agg a using (month_ref)
  order by m.month_ref;
$$;

-- ---------------------------------------------------------------------
-- 7) Permissões
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.invitations to authenticated;
grant select on public.invitations to anon;
grant all on public.invitations to service_role;

grant execute on function public.create_family_invite(uuid, text, public.family_role) to authenticated;
grant execute on function public.accept_family_invite(uuid) to authenticated;
grant execute on function public.revoke_family_invite(uuid) to authenticated;
grant execute on function public.category_budget_vs_actual(uuid, date) to authenticated;
grant execute on function public.historical_monthly_actuals(uuid, int, uuid) to authenticated;
