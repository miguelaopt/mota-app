-- =============================================================================
-- Modo Trabalho (migration aditiva: não altera tabelas existentes)
--
-- Regra central: ganhos estimados ≠ planeado para a mota ≠ poupança real.
--   * Os turnos só guardam tempo e as condições copiadas na entrada; ganhos e
--     parcela planeada são derivados (cêntimos, arredondados no fim).
--   * O dinheiro real continua a viver em accounts/balance_snapshots.
--     savings_attributions só classifica parte de uma atualização de saldo já
--     existente como "poupança do trabalho"; nunca soma dinheiro ao saldo.
--
-- Montantes em cêntimos (integer) e percentagens em pontos base (0–10000).
-- Instantes em timestamptz (UTC); o fuso só serve para apresentar.
--
-- Rollback (apaga só os dados do modo Trabalho):
--   drop function if exists public.confirm_work_savings(uuid, uuid, integer, numeric, bigint, uuid[], text);
--   drop table if exists public.savings_attribution_shifts, public.savings_attributions,
--     public.shift_breaks, public.shifts, public.scheduled_shifts, public.work_settings;
--   drop function if exists public.track_shift_corrections();
--   drop type if exists public.pay_mode, public.goal_target, public.scheduled_shift_status;
-- =============================================================================

create type public.pay_mode as enum ('hourly', 'monthly');
create type public.goal_target as enum ('minimum', 'full');
create type public.scheduled_shift_status as enum ('planned', 'done', 'cancelled');

-- -----------------------------------------------------------------------------
-- Configuração do trabalho (uma linha por utilizador)
-- -----------------------------------------------------------------------------
create table public.work_settings (
  user_id                 uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  job_name                text not null check (char_length(btrim(job_name)) between 1 and 60),
  pay_mode                public.pay_mode not null default 'hourly',
  -- Valor líquido/hora estimado usado nas contas (em salário fixo, o equivalente horário).
  hourly_rate_cents       integer not null check (hourly_rate_cents between 0 and 100000),
  -- Só em salário fixo: de onde veio o equivalente horário (salário ÷ horas).
  monthly_salary_cents    integer check (monthly_salary_cents between 0 and 100000000),
  monthly_hours           numeric(6,2) check (monthly_hours > 0 and monthly_hours <= 744),
  -- Parte dos ganhos estimados destinada à mota.
  allocation_bp           integer not null default 10000 check (allocation_bp between 0 and 10000),
  target                  public.goal_target not null default 'minimum',
  -- Comportamento por omissão das pausas (pode mudar em cada pausa).
  paid_breaks             boolean not null default false,
  -- Duração paga de referência para "turnos equivalentes" (null = média dos turnos).
  reference_shift_minutes integer check (reference_shift_minutes between 1 and 1440),
  -- Frequência habitual, para a data prevista sem calendário (null = sem data).
  shifts_per_week         numeric(4,2) check (shifts_per_week > 0 and shifts_per_week <= 21),
  time_zone               text not null default 'Europe/Lisbon',
  haptics                 boolean not null default true,
  animations              boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger work_settings_updated_at before update on public.work_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Turnos planeados (MVP: introduzidos à mão; repetição semanal na fase 2)
-- O horário planeado nunca inicia nem termina um turno sozinho.
-- -----------------------------------------------------------------------------
create table public.scheduled_shifts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  unpaid_break_minutes integer not null default 0 check (unpaid_break_minutes between 0 and 720),
  status               public.scheduled_shift_status not null default 'planned',
  notes                text check (char_length(notes) <= 500),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, user_id),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '24 hours')
);

create index scheduled_shifts_user_idx on public.scheduled_shifts (user_id, starts_at);

create trigger scheduled_shifts_updated_at before update on public.scheduled_shifts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Turnos reais. O id é gerado no telemóvel, para que picar entrada/saída
-- funcione offline e repetir o mesmo pedido não crie um segundo turno.
-- -----------------------------------------------------------------------------
create table public.shifts (
  id                  uuid primary key,
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Objetivo a que o turno está associado (por id, não pelo nome da mota).
  motorcycle_id       uuid,
  scheduled_shift_id  uuid,
  started_at          timestamptz not null,
  -- null = turno a decorrer.
  ended_at            timestamptz,
  planned_end_at      timestamptz,
  -- Condições copiadas na entrada: mudar as definições não altera turnos antigos.
  pay_mode            public.pay_mode not null,
  hourly_rate_cents   integer not null check (hourly_rate_cents between 0 and 100000),
  allocation_bp       integer not null check (allocation_bp between 0 and 10000),
  target              public.goal_target not null,
  -- Rastreabilidade das correções de horário (preenchido pelo trigger).
  version             integer not null default 1,
  edited_at           timestamptz,
  original_started_at timestamptz,
  original_ended_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, user_id),
  check (ended_at is null or ended_at > started_at),
  check (planned_end_at is null or planned_end_at > started_at),
  foreign key (motorcycle_id, user_id) references public.motorcycles (id, user_id) on delete set null (motorcycle_id),
  foreign key (scheduled_shift_id, user_id) references public.scheduled_shifts (id, user_id) on delete set null (scheduled_shift_id)
);

-- Só um turno ativo por utilizador (também protege contra dois dispositivos).
create unique index shifts_one_active_per_user on public.shifts (user_id) where ended_at is null;
create index shifts_user_started_idx on public.shifts (user_id, started_at desc);

create trigger shifts_updated_at before update on public.shifts
  for each row execute function public.set_updated_at();

-- Corrigir a entrada, ou a saída de um turno já terminado, conta como correção:
-- guarda o horário original (só da primeira vez) e incrementa a versão.
-- Picar saída (ended_at de null para um valor) não é uma correção.
create or replace function public.track_shift_corrections()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.started_at is distinct from old.started_at
     or (old.ended_at is not null and new.ended_at is distinct from old.ended_at) then
    new.version = old.version + 1;
    new.edited_at = now();
    new.original_started_at = coalesce(old.original_started_at, old.started_at);
    new.original_ended_at = coalesce(old.original_ended_at, old.ended_at);
  end if;
  return new;
end;
$$;

create trigger shifts_track_corrections before update on public.shifts
  for each row execute function public.track_shift_corrections();

-- -----------------------------------------------------------------------------
-- Pausas de cada turno
-- -----------------------------------------------------------------------------
create table public.shift_breaks (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  shift_id   uuid not null,
  started_at timestamptz not null,
  ended_at   timestamptz,
  paid       boolean not null,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  foreign key (shift_id, user_id) references public.shifts (id, user_id) on delete cascade
);

create unique index shift_breaks_one_open_per_shift on public.shift_breaks (shift_id) where ended_at is null;
create index shift_breaks_shift_idx on public.shift_breaks (shift_id, started_at);

-- -----------------------------------------------------------------------------
-- Poupança do trabalho confirmada
-- Classifica parte de uma atualização de saldo (balance_snapshots) como vinda
-- do trabalho. Não é um segundo saldo: o total das contas não muda.
-- -----------------------------------------------------------------------------
create table public.savings_attributions (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id    uuid not null,
  -- Atualização de saldo de origem. Se for apagada do histórico, a atribuição
  -- mantém-se (o saldo da conta também não muda nesse caso).
  snapshot_id   bigint references public.balance_snapshots (id) on delete set null,
  motorcycle_id uuid,
  amount_cents  integer not null check (amount_cents > 0),
  notes         text check (char_length(notes) <= 500),
  confirmed_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade,
  foreign key (motorcycle_id, user_id) references public.motorcycles (id, user_id) on delete set null (motorcycle_id)
);

create index savings_attributions_user_idx on public.savings_attributions (user_id, confirmed_at);
create index savings_attributions_snapshot_idx on public.savings_attributions (snapshot_id);

-- Turnos reconciliados por cada confirmação (cada turno só uma vez).
create table public.savings_attribution_shifts (
  attribution_id uuid not null,
  shift_id       uuid not null,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (attribution_id, shift_id),
  unique (shift_id),
  foreign key (attribution_id, user_id) references public.savings_attributions (id, user_id) on delete cascade,
  foreign key (shift_id, user_id) references public.shifts (id, user_id) on delete cascade
);

-- -----------------------------------------------------------------------------
-- RLS: cada utilizador só vê e altera as suas linhas.
-- -----------------------------------------------------------------------------
alter table public.work_settings              enable row level security;
alter table public.scheduled_shifts           enable row level security;
alter table public.shifts                     enable row level security;
alter table public.shift_breaks               enable row level security;
alter table public.savings_attributions       enable row level security;
alter table public.savings_attribution_shifts enable row level security;

create policy work_settings_own on public.work_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy scheduled_shifts_own on public.scheduled_shifts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy shifts_own on public.shifts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy shift_breaks_own on public.shift_breaks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy savings_attributions_own on public.savings_attributions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy savings_attribution_shifts_own on public.savings_attribution_shifts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Confirmar poupança do trabalho (atómico e idempotente pelo p_id).
--
-- Ou atualiza agora o saldo da conta (p_new_balance, em euros: o trigger
-- existente regista a atualização no histórico), ou liga a uma atualização já
-- feita (p_snapshot_id). Em ambos os casos o dinheiro entra uma única vez: a
-- atribuição só marca que parte desse aumento veio do trabalho, e nunca pode
-- ultrapassar o aumento registado.
-- -----------------------------------------------------------------------------
create or replace function public.confirm_work_savings(
  p_id            uuid,
  p_account_id    uuid,
  p_amount_cents  integer,
  p_new_balance   numeric,
  p_snapshot_id   bigint,
  p_shift_ids     uuid[],
  p_notes         text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user        uuid := (select auth.uid());
  v_old_balance numeric(12,2);
  v_snapshot    public.balance_snapshots%rowtype;
  v_previous    numeric(12,2);
  v_increase    integer;
  v_already     integer;
  v_motorcycle  uuid;
  v_shift_count integer;
begin
  if v_user is null then
    raise exception 'Sessão inválida.';
  end if;

  -- Pedido repetido (ex.: duplo toque ou reenvio depois de falhar a rede).
  if exists (select 1 from public.savings_attributions where id = p_id) then
    return p_id;
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Indica quanto guardaste.';
  end if;

  select balance into v_old_balance
    from public.accounts
   where id = p_account_id and archived_at is null
   for update;
  if not found then
    raise exception 'Conta não encontrada.';
  end if;

  if p_new_balance is not null then
    if p_new_balance is not distinct from v_old_balance then
      raise exception 'O novo saldo é igual ao atual. Se já atualizaste a conta, escolhe essa atualização.';
    end if;
    update public.accounts set balance = p_new_balance where id = p_account_id;
    -- O trigger record_balance_snapshot acabou de inserir o registo.
    select * into v_snapshot
      from public.balance_snapshots
     where account_id = p_account_id
     order by id desc
     limit 1;
  elsif p_snapshot_id is not null then
    select * into v_snapshot
      from public.balance_snapshots
     where id = p_snapshot_id and account_id = p_account_id;
  end if;

  if v_snapshot.id is null then
    raise exception 'Escolhe a atualização de saldo onde entrou este dinheiro.';
  end if;

  select balance into v_previous
    from public.balance_snapshots
   where account_id = p_account_id
     and (recorded_at, id) < (v_snapshot.recorded_at, v_snapshot.id)
   order by recorded_at desc, id desc
   limit 1;

  v_increase := round((v_snapshot.balance - coalesce(v_previous, 0)) * 100);
  select coalesce(sum(amount_cents), 0) into v_already
    from public.savings_attributions
   where snapshot_id = v_snapshot.id;

  if v_already + p_amount_cents > v_increase then
    raise exception 'Esta atualização de saldo só tem % € por atribuir.',
      replace(to_char(greatest(v_increase - v_already, 0) / 100.0, 'FM999999990.00'), '.', ',');
  end if;

  select count(*) into v_shift_count
    from public.shifts s
   where s.id = any (coalesce(p_shift_ids, '{}'))
     and s.ended_at is not null
     and not exists (select 1 from public.savings_attribution_shifts a where a.shift_id = s.id);
  if v_shift_count <> coalesce(cardinality(p_shift_ids), 0) then
    raise exception 'Algum dos turnos escolhidos ainda está a decorrer ou já foi confirmado.';
  end if;

  select id into v_motorcycle from public.motorcycles where is_active limit 1;

  insert into public.savings_attributions (id, user_id, account_id, snapshot_id, motorcycle_id, amount_cents, notes)
  values (p_id, v_user, p_account_id, v_snapshot.id, v_motorcycle, p_amount_cents, nullif(btrim(p_notes), ''));

  insert into public.savings_attribution_shifts (attribution_id, shift_id, user_id)
  select p_id, unnest(coalesce(p_shift_ids, '{}')), v_user;

  return p_id;
end;
$$;

revoke execute on function public.confirm_work_savings(uuid, uuid, integer, numeric, bigint, uuid[], text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.confirm_work_savings(uuid, uuid, integer, numeric, bigint, uuid[], text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.confirm_work_savings(uuid, uuid, integer, numeric, bigint, uuid[], text) to authenticated';
  end if;
end;
$$;
