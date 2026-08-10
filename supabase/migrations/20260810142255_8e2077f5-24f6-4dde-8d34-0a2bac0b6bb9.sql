-- 1) TABELA DE FATURAS
create table public.card_invoices (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.credit_cards(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  cycle_month date not null,
  due_date date not null,
  total_amount numeric(12,2) not null default 0,
  status text not null default 'open' check (status in ('open','closed','paid')),
  paid_at date,
  linked_transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_id, cycle_month)
);

grant select, insert, update, delete on public.card_invoices to authenticated;
grant all on public.card_invoices to service_role;

alter table public.card_invoices enable row level security;

create policy "select card_invoices" on public.card_invoices
  for select to authenticated using (public.is_family_member(family_id));
create policy "insert card_invoices" on public.card_invoices
  for insert to authenticated with check (public.can_write(family_id));
create policy "update card_invoices" on public.card_invoices
  for update to authenticated using (public.can_write(family_id)) with check (public.can_write(family_id));
create policy "delete card_invoices" on public.card_invoices
  for delete to authenticated using (public.is_family_admin(family_id));

create trigger t_card_invoices_touch before update on public.card_invoices
  for each row execute function public.touch_updated_at();

create index idx_card_invoices_card on public.card_invoices(card_id, cycle_month);

-- 2) EXPANSÃO DE LANÇAMENTOS DO CARTÃO
create or replace function public.card_charges_expanded(p_card_id uuid, p_cycles int default 6)
returns table (charge_date date, description text, amount numeric)
language sql
stable
set search_path to 'public'
as $$
  with cycles as (
    select (current_date + (n || ' months')::interval)::date as ref
    from generate_series(0, greatest(p_cycles,1) - 1) as n
  ),
  base as (
    select * from public.transactions where card_id = p_card_id and type = 'expense'
  ),
  expanded as (
    select b.tx_date as charge_date, b.description, b.amount
    from base b
    where b.recurrence = 'none'
    union all
    select (date_trunc('month', c.ref) + ((extract(day from b.tx_date)::int - 1) || ' days')::interval)::date,
           b.description, b.amount
    from base b cross join cycles c
    where b.recurrence = 'monthly'
      and date_trunc('month', c.ref) >= date_trunc('month', b.tx_date)
      and (b.recurrence_end is null or date_trunc('month', c.ref) <= date_trunc('month', b.recurrence_end))
    union all
    select (date_trunc('month', c.ref) + ((extract(day from b.tx_date)::int - 1) || ' days')::interval)::date,
           b.description || ' (' ||
             (extract(month from age(date_trunc('month', c.ref), date_trunc('month', b.tx_date)))::int
              + (extract(year from age(date_trunc('month', c.ref), date_trunc('month', b.tx_date)))::int * 12)
              + coalesce(b.installment_no, 1))
             || '/' || b.installment_total || ')',
           b.amount
    from base b cross join cycles c
    where b.recurrence = 'installment'
      and b.installment_total is not null
      and date_trunc('month', c.ref) >= date_trunc('month', b.tx_date)
      and date_trunc('month', c.ref) < date_trunc('month', b.tx_date)
          + ((b.installment_total - coalesce(b.installment_no, 1) + 1) || ' months')::interval
  )
  select e.charge_date, e.description, e.amount from expanded e;
$$;

-- 3) AGRUPAMENTO POR FATURA
create or replace function public.card_invoice_projection(p_card_id uuid, p_cycles int default 6)
returns table (cycle_month date, due_date date, total_amount numeric, charge_count int)
language plpgsql
stable
set search_path to 'public'
as $$
declare
  v_closing_day int;
  v_due_day int;
begin
  select closing_day, due_day into v_closing_day, v_due_day
  from public.credit_cards where id = p_card_id;

  if v_closing_day is null then
    return;
  end if;

  return query
  with charges as (
    select ce.*,
      case
        when extract(day from ce.charge_date)::int <= v_closing_day
          then date_trunc('month', ce.charge_date)::date
        else (date_trunc('month', ce.charge_date) + interval '1 month')::date
      end as invoice_cycle_month
    from public.card_charges_expanded(p_card_id, p_cycles + 1) ce
  )
  select
    c.invoice_cycle_month,
    case
      when v_due_day <= v_closing_day
        then (c.invoice_cycle_month + interval '1 month' + ((v_due_day - 1) || ' days')::interval)::date
      else (c.invoice_cycle_month + ((v_due_day - 1) || ' days')::interval)::date
    end,
    sum(c.amount),
    count(*)::int
  from charges c
  where c.invoice_cycle_month >= date_trunc('month', current_date)::date
    and c.invoice_cycle_month < (date_trunc('month', current_date) + (greatest(p_cycles,1) || ' months')::interval)::date
  group by c.invoice_cycle_month
  order by c.invoice_cycle_month;
end;
$$;

-- 4) SINCRONIZAÇÃO
create or replace function public.sync_card_invoices(p_card_id uuid, p_cycles int default 6)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_family_id uuid;
  v_row record;
begin
  select family_id into v_family_id from public.credit_cards where id = p_card_id;
  if v_family_id is null then return; end if;

  for v_row in select * from public.card_invoice_projection(p_card_id, p_cycles) loop
    insert into public.card_invoices (card_id, family_id, cycle_month, due_date, total_amount, status)
    values (p_card_id, v_family_id, v_row.cycle_month, v_row.due_date, v_row.total_amount, 'open')
    on conflict (card_id, cycle_month) do update
      set total_amount = excluded.total_amount,
          due_date = excluded.due_date
      where card_invoices.status <> 'paid';
  end loop;
end;
$$;

create or replace function public.sync_all_card_invoices()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_card record;
begin
  for v_card in select id from public.credit_cards loop
    perform public.sync_card_invoices(v_card.id);
  end loop;
end;
$$;

-- 5) LIMITE DISPONÍVEL
create or replace function public.card_available_limit(p_card_id uuid)
returns numeric
language sql
stable
set search_path to 'public'
as $$
  select cc.credit_limit - coalesce((
    select sum(ci.total_amount) from public.card_invoices ci
    where ci.card_id = cc.id and ci.status <> 'paid'
  ), 0)
  from public.credit_cards cc
  where cc.id = p_card_id;
$$;

-- 6) MARCAR FATURA COMO PAGA
create or replace function public.pay_card_invoice(p_invoice_id uuid, p_category_id uuid default null, p_owner_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_invoice public.card_invoices;
  v_transaction_id uuid;
begin
  select * into v_invoice from public.card_invoices where id = p_invoice_id;
  if v_invoice.id is null then
    raise exception 'invoice not found';
  end if;
  if not public.can_write(v_invoice.family_id) then
    raise exception 'not allowed';
  end if;

  insert into public.transactions (
    family_id, category_id, owner_id, card_id, description,
    amount, type, status, payment_method, recurrence, tx_date, created_by
  ) values (
    v_invoice.family_id, p_category_id, p_owner_id, v_invoice.card_id,
    'Fatura do cartão — ' || to_char(v_invoice.cycle_month, 'MM/YYYY'),
    v_invoice.total_amount, 'expense', 'realized', 'credit', 'none',
    v_invoice.due_date, auth.uid()
  )
  returning id into v_transaction_id;

  update public.card_invoices
  set status = 'paid', paid_at = current_date, linked_transaction_id = v_transaction_id
  where id = p_invoice_id;

  return v_transaction_id;
end;
$$;