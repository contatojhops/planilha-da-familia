-- shared expense splits
create table public.shared_expense_splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  share_amount numeric(12,2) not null,
  is_settled boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_splits_tx on public.shared_expense_splits (transaction_id);

grant select, insert, update, delete on public.shared_expense_splits to authenticated;
grant all on public.shared_expense_splits to service_role;

alter table public.shared_expense_splits enable row level security;

create policy "splits select" on public.shared_expense_splits
  for select to authenticated using (public.is_family_member(family_id));
create policy "splits insert" on public.shared_expense_splits
  for insert to authenticated with check (public.can_write(family_id));
create policy "splits update" on public.shared_expense_splits
  for update to authenticated using (public.can_write(family_id)) with check (public.can_write(family_id));
create policy "splits delete" on public.shared_expense_splits
  for delete to authenticated using (public.can_write(family_id));

-- investment value history
create table public.investment_value_history (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.investments(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  value numeric(12,2) not null,
  recorded_at date not null default current_date,
  created_at timestamptz not null default now()
);
create index idx_inv_history on public.investment_value_history (investment_id, recorded_at);

grant select, insert, update, delete on public.investment_value_history to authenticated;
grant all on public.investment_value_history to service_role;

alter table public.investment_value_history enable row level security;

create policy "inv history select" on public.investment_value_history
  for select to authenticated using (public.is_family_member(family_id));
create policy "inv history insert" on public.investment_value_history
  for insert to authenticated with check (public.can_write(family_id));
create policy "inv history update" on public.investment_value_history
  for update to authenticated using (public.can_write(family_id)) with check (public.can_write(family_id));
create policy "inv history delete" on public.investment_value_history
  for delete to authenticated using (public.can_write(family_id));

-- monthly projection with cumulative balance
create or replace function public.monthly_projection(p_family_id uuid, p_months int default 12)
returns table (
  month_ref date,
  total_income numeric,
  total_expense numeric,
  net_balance numeric,
  cumulative_balance numeric,
  is_positive boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with months as (
    select date_trunc('month', current_date + (n || ' months')::interval)::date as month_ref
    from generate_series(0, greatest(p_months, 1) - 1) as n
  ),
  agg as (
    select
      date_trunc('month', t.tx_date)::date as month_ref,
      sum(case when t.type = 'income' then t.amount else 0 end) as total_income,
      sum(case when t.type = 'expense' then t.amount else 0 end) as total_expense
    from public.transactions t
    where t.family_id = p_family_id
    group by 1
  ),
  joined as (
    select
      m.month_ref,
      coalesce(a.total_income, 0) as total_income,
      coalesce(a.total_expense, 0) as total_expense,
      coalesce(a.total_income, 0) - coalesce(a.total_expense, 0) as net_balance
    from months m
    left join agg a using (month_ref)
  )
  select
    j.month_ref,
    j.total_income,
    j.total_expense,
    j.net_balance,
    sum(j.net_balance) over (order by j.month_ref) as cumulative_balance,
    j.net_balance >= 0 as is_positive
  from joined j
  order by j.month_ref;
$$;