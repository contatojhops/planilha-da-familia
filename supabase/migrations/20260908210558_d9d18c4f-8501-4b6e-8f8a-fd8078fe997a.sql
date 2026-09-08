-- =====================================================================
-- BASE PARA A TELA DE AJUSTES
-- =====================================================================

-- 1) Limiares do semáforo, hoje fixos em -500/100 no código do front,
--    passam a ser configuráveis por família.
alter table public.families
  add column if not exists deficit_alert_threshold numeric(14,2) not null default -500,
  add column if not exists warning_threshold numeric(14,2) not null default 100;

-- 2) Permitir que um membro saia da família por conta própria — hoje
--    a única policy de delete em family_members é do admin removendo
--    OUTRO membro (user_id <> auth.uid()); não existe nenhuma forma
--    de auto-remoção. Replica a mesma regra que já existe no front
--    (não pode sair se for o único admin).
create policy "member leaves family" on public.family_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    and not (
      role = 'admin'
      and (
        select count(*) from public.family_members fm2
        where fm2.family_id = family_members.family_id and fm2.role = 'admin'
      ) = 1
    )
  );