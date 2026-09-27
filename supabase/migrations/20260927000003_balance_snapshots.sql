-- =============================================================================
-- Histórico de saldos
-- Cada alteração de saldo (ou dos parâmetros que definem quanto conta para a
-- mota) cria um registo em balance_snapshots. Arquivar uma conta regista saldo
-- 0, para que deixe de contar nos totais reconstruídos a partir do histórico.
-- =============================================================================

create or replace function public.record_balance_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.balance is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.balance is not distinct from old.balance
     and new.kind = old.kind
     and new.count_pct = old.count_pct
     and new.safety_margin_pct = old.safety_margin_pct
     and (new.archived_at is null) = (old.archived_at is null) then
    return new;
  end if;

  insert into public.balance_snapshots
    (user_id, account_id, balance, kind, count_pct, safety_margin_pct)
  values (
    new.user_id,
    new.id,
    case when new.archived_at is null then new.balance else 0 end,
    new.kind,
    new.count_pct,
    new.safety_margin_pct
  );

  return new;
end;
$$;

create trigger accounts_record_snapshot
  after insert or update on public.accounts
  for each row execute function public.record_balance_snapshot();
