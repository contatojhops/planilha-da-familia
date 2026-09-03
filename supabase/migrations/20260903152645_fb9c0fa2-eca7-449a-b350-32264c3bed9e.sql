-- =====================================================================
-- Permite admin alterar papel e remover outros membros da família
-- =====================================================================

drop policy if exists "admin updates member roles" on public.family_members;
create policy "admin updates member roles" on public.family_members
  for update to authenticated
  using (public.is_family_admin(family_id))
  with check (public.is_family_admin(family_id));

drop policy if exists "admin deletes members" on public.family_members;
create policy "admin deletes members" on public.family_members
  for delete to authenticated
  using (public.is_family_admin(family_id));
