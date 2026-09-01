create or replace function public.trg_sync_card_invoice_on_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.card_id is not null then
      perform public.sync_card_invoices(old.card_id);
    end if;
    return old;
  end if;

  if new.card_id is not null then
    perform public.sync_card_invoices(new.card_id);
  end if;

  if tg_op = 'UPDATE' and old.card_id is not null and old.card_id is distinct from new.card_id then
    perform public.sync_card_invoices(old.card_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_transactions_sync_card_invoice on public.transactions;

create trigger trg_transactions_sync_card_invoice
  after insert or delete or update of card_id, amount, tx_date, recurrence, recurrence_end, installment_no, installment_total, type
  on public.transactions
  for each row execute function public.trg_sync_card_invoice_on_transaction();

do $$
begin
  perform public.sync_all_card_invoices();
end;
$$;