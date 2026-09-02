revoke execute on function public.handle_new_user() from public;
revoke execute on function public.log_tx_audit() from public;
revoke execute on function public.touch_updated_at() from public;
revoke execute on function public.trg_sync_card_invoice_on_transaction() from public;
revoke execute on function public.update_goal_current_amount() from public;
revoke execute on function public.update_investment_current_value() from public;
revoke execute on function public.seed_default_categories() from public;
revoke execute on function public.seed_default_categories_for(uuid) from public;
revoke execute on function public.sync_card_invoices(uuid, integer) from public;
revoke execute on function public.sync_all_card_invoices() from public;
revoke execute on function public.capture_net_worth_snapshot(uuid) from public;
revoke execute on function public.capture_all_net_worth_snapshots() from public;

revoke execute on function public.can_write(uuid) from public;
revoke execute on function public.family_role_of(uuid) from public;
revoke execute on function public.is_family_admin(uuid) from public;
revoke execute on function public.is_family_member(uuid) from public;
revoke execute on function public.create_family_with_owner(text, text) from public;
revoke execute on function public.pay_card_invoice(uuid, uuid, uuid) from public;

grant execute on function public.can_write(uuid) to authenticated;
grant execute on function public.family_role_of(uuid) to authenticated;
grant execute on function public.is_family_admin(uuid) to authenticated;
grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.create_family_with_owner(text, text) to authenticated;
grant execute on function public.pay_card_invoice(uuid, uuid, uuid) to authenticated;