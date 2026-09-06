-- =====================================================================
-- PERMITIR QUE ADMIN EDITE O PERFIL DE OUTROS MEMBROS
-- =====================================================================
create policy "family admin updates member profiles" on public.profiles
  for update to authenticated
  using (
    exists (
      select 1 from public.family_members me
      join public.family_members other on other.family_id = me.family_id
      where me.user_id = auth.uid()
        and me.role = 'admin'
        and other.user_id = profiles.id
    )
  );