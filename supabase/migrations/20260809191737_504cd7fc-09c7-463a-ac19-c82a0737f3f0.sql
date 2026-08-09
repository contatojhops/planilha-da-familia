-- 1) Triggers de atualização automática
create or replace function public.update_goal_current_amount()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.goals set current_amount = current_amount + new.amount where id = new.goal_id;
  return new;
end; $$;

drop trigger if exists trg_goal_contribution_update on public.goal_contributions;
create trigger trg_goal_contribution_update
  after insert on public.goal_contributions
  for each row execute function public.update_goal_current_amount();

create or replace function public.update_investment_current_value()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.investments set current_value = new.value where id = new.investment_id;
  return new;
end; $$;

drop trigger if exists trg_investment_value_update on public.investment_value_history;
create trigger trg_investment_value_update
  after insert on public.investment_value_history
  for each row execute function public.update_investment_current_value();

-- 2) Metas com progresso e projeção
create or replace function public.goals_with_progress(p_family_id uuid)
returns table (
  goal_id uuid,
  name text,
  target_amount numeric,
  current_amount numeric,
  progress_percent numeric,
  target_date date,
  monthly_pace numeric,
  projected_completion_date date
)
language sql stable set search_path = public as $$
  with contrib_stats as (
    select
      gc.goal_id,
      sum(gc.amount) / greatest(1,
        (date_part('year', age(current_date, min(gc.contributed_at))) * 12
         + date_part('month', age(current_date, min(gc.contributed_at)))) + 1) as avg_monthly
    from public.goal_contributions gc
    group by gc.goal_id
  )
  select
    g.id,
    g.name,
    g.target_amount,
    g.current_amount,
    round(least(100, (g.current_amount / nullif(g.target_amount, 0)) * 100), 1),
    g.target_date,
    cs.avg_monthly,
    case
      when cs.avg_monthly > 0 and g.current_amount < g.target_amount
        then (current_date + (ceil((g.target_amount - g.current_amount) / cs.avg_monthly) || ' months')::interval)::date
      else null
    end
  from public.goals g
  left join contrib_stats cs on cs.goal_id = g.id
  where g.family_id = p_family_id;
$$;

-- 3) Distribuição da carteira
create or replace function public.portfolio_allocation(p_family_id uuid)
returns table (asset_class public.asset_class, total_value numeric, percent numeric)
language sql stable set search_path = public as $$
  with totals as (
    select i.asset_class, sum(i.current_value) as total_value
    from public.investments i
    where i.family_id = p_family_id
    group by i.asset_class
  ), grand_total as (
    select sum(t.total_value) as gt from totals t
  )
  select t.asset_class, t.total_value,
    round((t.total_value / nullif(gt.gt, 0)) * 100, 1)
  from totals t cross join grand_total gt;
$$;

-- 4) Saldo em conta (realizado)
create or replace function public.current_balance(p_family_id uuid)
returns numeric language sql stable set search_path = public as $$
  select coalesce(sum(case when t.type = 'income' then t.amount else -t.amount end), 0)
  from public.transactions t
  where t.family_id = p_family_id
    and t.status = 'realized'
    and t.tx_date <= current_date;
$$;

-- 5) Evolução patrimonial
create table if not exists public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  snapshot_date date not null default current_date,
  cash_balance numeric(14,2) not null,
  investments_value numeric(14,2) not null,
  debts_value numeric(14,2) not null,
  net_worth numeric(14,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, snapshot_date)
);

grant select on public.net_worth_snapshots to authenticated;
grant all on public.net_worth_snapshots to service_role;

alter table public.net_worth_snapshots enable row level security;

drop policy if exists "nws select" on public.net_worth_snapshots;
create policy "nws select" on public.net_worth_snapshots
  for select to authenticated using (public.is_family_member(family_id));

drop trigger if exists t_nws_touch on public.net_worth_snapshots;
create trigger t_nws_touch before update on public.net_worth_snapshots
  for each row execute function public.touch_updated_at();

create or replace function public.capture_net_worth_snapshot(p_family_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cash numeric; v_inv numeric; v_debts numeric;
begin
  v_cash := public.current_balance(p_family_id);
  select coalesce(sum(current_value), 0) into v_inv from public.investments where family_id = p_family_id;
  select coalesce(sum(amount), 0) into v_debts from public.bills
    where family_id = p_family_id and status in ('pending','overdue','scheduled');

  insert into public.net_worth_snapshots (family_id, snapshot_date, cash_balance, investments_value, debts_value, net_worth)
  values (p_family_id, current_date, v_cash, v_inv, v_debts, v_cash + v_inv - v_debts)
  on conflict (family_id, snapshot_date) do update
    set cash_balance = excluded.cash_balance,
        investments_value = excluded.investments_value,
        debts_value = excluded.debts_value,
        net_worth = excluded.net_worth;
end; $$;

create or replace function public.capture_all_net_worth_snapshots()
returns void language plpgsql security definer set search_path = public as $$
declare v_family record;
begin
  for v_family in select id from public.families loop
    perform public.capture_net_worth_snapshot(v_family.id);
  end loop;
end; $$;

revoke all on function public.capture_net_worth_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.capture_all_net_worth_snapshots() from public, anon, authenticated;