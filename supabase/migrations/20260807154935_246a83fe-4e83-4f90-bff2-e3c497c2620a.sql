create or replace function public.projected_transactions(
  p_family_id uuid,
  p_months int default 12
)
returns table (
  month_ref date,
  type public.tx_type,
  amount numeric
)
language sql
stable
set search_path = public
as $$
  with months as (
    select date_trunc('month', current_date + (n || ' months')::interval)::date as month_ref
    from generate_series(0, greatest(p_months, 1) - 1) as n
  ),
  base as (
    select * from public.transactions where family_id = p_family_id
  ),
  expanded as (
    select date_trunc('month', b.tx_date)::date as month_ref, b.type, b.amount
    from base b
    where b.recurrence = 'none'
    union all
    select m.month_ref, b.type, b.amount
    from base b
    cross join months m
    where b.recurrence = 'monthly'
      and m.month_ref >= date_trunc('month', b.tx_date)::date
      and (b.recurrence_end is null or m.month_ref <= date_trunc('month', b.recurrence_end)::date)
    union all
    select m.month_ref, b.type, b.amount
    from base b
    cross join months m
    where b.recurrence = 'yearly'
      and m.month_ref >= date_trunc('month', b.tx_date)::date
      and (b.recurrence_end is null or m.month_ref <= date_trunc('month', b.recurrence_end)::date)
      and extract(month from m.month_ref) = extract(month from b.tx_date)
    union all
    select m.month_ref, b.type, b.amount
    from base b
    cross join months m
    where b.recurrence = 'installment'
      and b.installment_total is not null
      and m.month_ref >= date_trunc('month', b.tx_date)::date
      and m.month_ref < (date_trunc('month', b.tx_date)::date
          + ((b.installment_total - coalesce(b.installment_no, 1) + 1) || ' months')::interval)
  )
  select e.month_ref, e.type, e.amount from expanded e;
$$;

create or replace function public.monthly_projection(
  p_family_id uuid,
  p_months int default 12
)
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
set search_path = public
as $$
  with months as (
    select date_trunc('month', current_date + (n || ' months')::interval)::date as month_ref
    from generate_series(0, greatest(p_months, 1) - 1) as n
  ),
  agg as (
    select
      p.month_ref,
      sum(case when p.type = 'income' then p.amount else 0 end) as total_income,
      sum(case when p.type = 'expense' then p.amount else 0 end) as total_expense
    from public.projected_transactions(p_family_id, p_months) p
    group by p.month_ref
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

revoke all on function public.projected_transactions(uuid, int) from public;
revoke all on function public.monthly_projection(uuid, int) from public;
grant execute on function public.projected_transactions(uuid, int) to authenticated;
grant execute on function public.monthly_projection(uuid, int) to authenticated;