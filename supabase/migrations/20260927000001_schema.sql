-- =============================================================================
-- Mota: esquema base
-- Todos os valores monetários em euros, numeric(12,2).
-- Cada linha pertence a um utilizador (user_id = auth.uid()); ver RLS na
-- migration seguinte.
-- =============================================================================

create type public.account_kind as enum ('available', 'invested');
create type public.gear_category as enum ('protection', 'comfort', 'aesthetic_performance', 'other');
create type public.item_priority as enum ('essential', 'later');
create type public.gear_status as enum ('to_buy', 'bought');
create type public.cost_kind as enum ('one_off', 'monthly');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Preferências (uma linha por utilizador)
-- -----------------------------------------------------------------------------
create table public.settings (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Usada para a data prevista quando ainda não há histórico suficiente.
  monthly_goal numeric(12,2) not null default 0 check (monthly_goal >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Contas
-- -----------------------------------------------------------------------------
create table public.accounts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name               text not null check (char_length(btrim(name)) between 1 and 60),
  kind               public.account_kind not null default 'available',
  -- null = saldo ainda não definido (não entra nos totais nem no histórico).
  balance            numeric(12,2),
  balance_updated_at timestamptz,
  -- Percentagem do saldo que conta para a mota.
  count_pct          numeric(5,2) not null default 100 check (count_pct between 0 and 100),
  -- Margem de segurança: só é aplicada a contas 'invested'.
  safety_margin_pct  numeric(5,2) not null default 100 check (safety_margin_pct between 0 and 100),
  -- 'manual' ou, na fase 2, uma integração (ex.: 'trading212').
  source             text not null default 'manual',
  sort_order         integer not null default 0,
  -- "Remover" uma conta arquiva-a, para não apagar o histórico.
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, user_id)
);

create index accounts_user_idx on public.accounts (user_id, sort_order);

create trigger accounts_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

create or replace function public.touch_balance_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.balance is not null
     and (tg_op = 'INSERT' or new.balance is distinct from old.balance) then
    new.balance_updated_at = now();
  end if;
  return new;
end;
$$;

create trigger accounts_balance_updated_at before insert or update on public.accounts
  for each row execute function public.touch_balance_updated_at();

-- -----------------------------------------------------------------------------
-- Histórico de saldos (escrito pelo trigger em accounts; ver migration 3)
-- Guarda os parâmetros da conta nesse momento, para que o valor que contava
-- para a mota não mude retroativamente se editares a % ou a margem.
-- -----------------------------------------------------------------------------
create table public.balance_snapshots (
  id                bigint generated always as identity primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id        uuid not null,
  balance           numeric(12,2) not null,
  kind              public.account_kind not null,
  count_pct         numeric(5,2) not null,
  safety_margin_pct numeric(5,2) not null,
  recorded_at       timestamptz not null default now(),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade
);

create index balance_snapshots_user_recorded_idx on public.balance_snapshots (user_id, recorded_at);
create index balance_snapshots_account_idx on public.balance_snapshots (account_id, recorded_at);

-- -----------------------------------------------------------------------------
-- Motas (preparado para várias candidatas; só uma ativa por utilizador)
-- -----------------------------------------------------------------------------
create table public.motorcycles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  model       text not null check (char_length(btrim(model)) between 1 and 100),
  price       numeric(12,2) not null default 0 check (price >= 0),
  -- Caminho no bucket "photos": <user_id>/motorcycles/<id>-<timestamp>.jpg
  photo_path  text,
  listing_url text,
  notes       text,
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);

create unique index motorcycles_one_active_per_user on public.motorcycles (user_id) where is_active;

create trigger motorcycles_updated_at before update on public.motorcycles
  for each row execute function public.set_updated_at();

-- Troca a mota ativa de forma atómica (usado na comparação da fase 2).
create or replace function public.set_active_motorcycle(p_motorcycle_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.motorcycles
    where id = p_motorcycle_id and user_id = (select auth.uid())
  ) then
    raise exception 'Mota não encontrada';
  end if;

  update public.motorcycles
     set is_active = false
   where user_id = (select auth.uid()) and is_active and id <> p_motorcycle_id;

  update public.motorcycles
     set is_active = true
   where id = p_motorcycle_id and user_id = (select auth.uid());
end;
$$;

-- -----------------------------------------------------------------------------
-- Equipamento
-- -----------------------------------------------------------------------------
create table public.gear_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 100),
  price        numeric(12,2) not null default 0 check (price >= 0),
  category     public.gear_category not null default 'other',
  priority     public.item_priority not null default 'essential',
  status       public.gear_status not null default 'to_buy',
  purchased_at date,
  store_url    text,
  -- Caminho no bucket "photos": <user_id>/gear/<id>-<timestamp>.jpg
  photo_path   text,
  notes        text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index gear_items_user_idx on public.gear_items (user_id, sort_order);

create trigger gear_items_updated_at before update on public.gear_items
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Custos
--   one_off : custos únicos da compra (contam para a meta)
--   monthly : custos mensais depois da compra (só informativos)
-- -----------------------------------------------------------------------------
create table public.costs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 100),
  amount        numeric(12,2) not null default 0 check (amount >= 0),
  kind          public.cost_kind not null,
  priority      public.item_priority not null default 'essential',
  -- null = aplica-se a qualquer mota; preenchido = só quando essa mota está ativa.
  motorcycle_id uuid,
  notes         text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (motorcycle_id, user_id) references public.motorcycles (id, user_id) on delete cascade
);

create index costs_user_idx on public.costs (user_id, kind, sort_order);

create trigger costs_updated_at before update on public.costs
  for each row execute function public.set_updated_at();
