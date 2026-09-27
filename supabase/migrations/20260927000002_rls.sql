-- =============================================================================
-- Row Level Security: cada utilizador só vê e altera as suas linhas.
-- `(select auth.uid())` em vez de `auth.uid()` para o Postgres avaliar a
-- função uma vez por query e não uma vez por linha.
-- =============================================================================

alter table public.settings          enable row level security;
alter table public.accounts          enable row level security;
alter table public.balance_snapshots enable row level security;
alter table public.motorcycles       enable row level security;
alter table public.gear_items        enable row level security;
alter table public.costs             enable row level security;

create policy settings_own on public.settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy accounts_own on public.accounts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy motorcycles_own on public.motorcycles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy gear_items_own on public.gear_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy costs_own on public.costs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- O histórico é escrito só pelo trigger em accounts (security definer) e não
-- pode ser alterado; apenas lido ou apagado (para corrigir enganos).
create policy balance_snapshots_select_own on public.balance_snapshots
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy balance_snapshots_delete_own on public.balance_snapshots
  for delete to authenticated
  using (user_id = (select auth.uid()));
