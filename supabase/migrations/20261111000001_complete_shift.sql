-- =============================================================================
-- "Turno feito" numa só ida à base de dados (antes eram até 7 pedidos seguidos).
-- Regista o turno do calendário com as pausas e marca o dia como feito, de forma
-- atómica e idempotente: repetir o pedido (duplo toque, reenvio offline) não
-- duplica nada; se o turno tiver sido apagado, volta a ser registado.
--
-- Devolve 'created' (registado), 'exists' (já estava registado) ou 'linked'
-- (já havia um turno a essa hora, que foi ligado ao calendário).
--
-- Rollback: drop function if exists public.complete_scheduled_shift(uuid, timestamptz, timestamptz, uuid, uuid, public.pay_mode, integer, integer, public.goal_target, jsonb);
-- =============================================================================

create or replace function public.complete_scheduled_shift(
  p_id                uuid,
  p_started_at        timestamptz,
  p_ended_at          timestamptz,
  p_scheduled_shift_id uuid,
  p_motorcycle_id     uuid,
  p_pay_mode          public.pay_mode,
  p_hourly_rate_cents integer,
  p_allocation_bp     integer,
  p_target            public.goal_target,
  p_breaks            jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user       uuid := (select auth.uid());
  v_scheduled  uuid;
  v_motorcycle uuid;
  v_overlap    record;
begin
  if v_user is null then
    raise exception 'Sessão inválida.';
  end if;

  if exists (select 1 from public.shifts where id = p_id) then
    return 'exists';
  end if;
  if p_started_at > now() + interval '5 minutes' then
    raise exception 'Este turno ainda não começou.';
  end if;
  if p_ended_at <= p_started_at then
    raise exception 'A saída tem de ser depois da entrada.';
  end if;

  -- O turno planeado ou a mota podem ter sido apagados enquanto estava offline.
  select id into v_scheduled from public.scheduled_shifts where id = p_scheduled_shift_id;
  select id into v_motorcycle from public.motorcycles where id = p_motorcycle_id;

  select id, ended_at, scheduled_shift_id into v_overlap
    from public.shifts
   where started_at < p_ended_at
     and (ended_at is null or ended_at > p_started_at)
   limit 1;
  if found then
    if v_overlap.ended_at is null then
      raise exception 'Tens um turno a decorrer a essa hora: pica a saída primeiro.';
    end if;
    -- O trabalho deste dia já foi registado de outra forma: liga-o ao calendário.
    if v_scheduled is not null then
      if v_overlap.scheduled_shift_id is null then
        update public.shifts set scheduled_shift_id = v_scheduled where id = v_overlap.id;
      end if;
      update public.scheduled_shifts set status = 'done' where id = v_scheduled;
    end if;
    return 'linked';
  end if;

  begin
    insert into public.shifts
      (id, user_id, started_at, ended_at, planned_end_at, scheduled_shift_id, motorcycle_id,
       pay_mode, hourly_rate_cents, allocation_bp, target)
    values
      (p_id, v_user, p_started_at, p_ended_at, p_ended_at, v_scheduled, v_motorcycle,
       p_pay_mode, p_hourly_rate_cents, p_allocation_bp, p_target);
  exception when unique_violation then
    -- Outro pedido igual chegou primeiro.
    return 'exists';
  end;

  insert into public.shift_breaks (id, user_id, shift_id, started_at, ended_at, paid)
  select (b ->> 'id')::uuid, v_user, p_id, (b ->> 'started_at')::timestamptz, (b ->> 'ended_at')::timestamptz, (b ->> 'paid')::boolean
    from jsonb_array_elements(coalesce(p_breaks, '[]'::jsonb)) as b;

  if v_scheduled is not null then
    update public.scheduled_shifts set status = 'done' where id = v_scheduled;
  end if;

  return 'created';
end;
$$;

revoke execute on function public.complete_scheduled_shift(uuid, timestamptz, timestamptz, uuid, uuid, public.pay_mode, integer, integer, public.goal_target, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.complete_scheduled_shift(uuid, timestamptz, timestamptz, uuid, uuid, public.pay_mode, integer, integer, public.goal_target, jsonb) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.complete_scheduled_shift(uuid, timestamptz, timestamptz, uuid, uuid, public.pay_mode, integer, integer, public.goal_target, jsonb) to authenticated';
  end if;
end;
$$;
