-- =============================================================================
-- Feriados no modo Trabalho: acréscimo pago nas horas em feriado.
-- Os feriados nacionais são calculados pela app; aqui ficam só as opções:
-- a percentagem de acréscimo, o feriado municipal e se o Carnaval é feriado.
-- Só acrescenta colunas; não mexe nos dados existentes.
--
-- Rollback:
--   alter table public.work_settings
--     drop column if exists holiday_premium_bp,
--     drop column if exists municipal_holiday,
--     drop column if exists carnival_holiday;
-- =============================================================================

alter table public.work_settings
  -- Pontos base: 5000 = +50% (cada hora vale 1,5×), 10000 = a dobrar.
  add column if not exists holiday_premium_bp integer not null default 5000
    check (holiday_premium_bp between 0 and 30000),
  -- "MM-DD", ex.: '06-13' (Santo António, Lisboa).
  add column if not exists municipal_holiday text
    check (municipal_holiday ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  add column if not exists carnival_holiday boolean not null default false;
