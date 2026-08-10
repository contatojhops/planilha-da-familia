revoke execute on function public.sync_card_invoices(uuid, int) from anon;
revoke execute on function public.sync_all_card_invoices() from anon;
revoke execute on function public.pay_card_invoice(uuid, uuid, uuid) from anon;
revoke execute on function public.card_charges_expanded(uuid, int) from anon;
revoke execute on function public.card_invoice_projection(uuid, int) from anon;
revoke execute on function public.card_available_limit(uuid) from anon;