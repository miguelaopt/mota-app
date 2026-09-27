-- =============================================================================
-- Dados iniciais de cada utilizador novo
-- Os preços começam a 0 € e a app assinala-os como "sem preço".
-- =============================================================================

create or replace function public.seed_user_defaults(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.settings where user_id = p_user_id) then
    return;
  end if;

  insert into public.settings (user_id) values (p_user_id);

  insert into public.accounts (user_id, name, kind, safety_margin_pct, sort_order) values
    (p_user_id, 'Trade Republic', 'available', 100, 1),
    (p_user_id, 'Revolut',        'available', 100, 2),
    (p_user_id, 'Trading 212',    'invested',   80, 3);

  insert into public.gear_items (user_id, name, category, priority, sort_order) values
    (p_user_id, 'Capacete',                         'protection',            'essential', 1),
    (p_user_id, 'Casaco',                           'protection',            'essential', 2),
    (p_user_id, 'Luvas',                            'protection',            'essential', 3),
    (p_user_id, 'Botas',                            'protection',            'essential', 4),
    (p_user_id, 'Aulas de reciclagem de condução',  'other',                 'essential', 5),
    (p_user_id, 'Intercomunicador Cardo',           'comfort',               'later',     6),
    (p_user_id, 'Escape',                           'aesthetic_performance', 'later',     7);

  insert into public.costs (user_id, name, kind, sort_order) values
    (p_user_id, 'Transferência de propriedade',          'one_off', 1),
    (p_user_id, 'Seguro (1.ª prestação)',                'one_off', 2),
    (p_user_id, 'IUC',                                   'one_off', 3),
    (p_user_id, 'Primeira revisão (óleo, pneus, corrente)', 'one_off', 4),
    (p_user_id, 'Seguro',                                'monthly', 1),
    (p_user_id, 'Combustível',                           'monthly', 2),
    (p_user_id, 'Manutenção',                            'monthly', 3),
    (p_user_id, 'Estacionamento',                        'monthly', 4);
end;
$$;

-- Só o trigger (e o dono da base de dados) podem correr o seed.
revoke execute on function public.seed_user_defaults(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.seed_user_defaults(uuid) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke execute on function public.seed_user_defaults(uuid) from authenticated';
  end if;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_user_defaults(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Utilizadores que já existiam antes desta migration.
select public.seed_user_defaults(id) from auth.users;
