-- =============================================================================
-- Ordenado mínimo por mês (opcional), para a data prevista do Início.
-- A previsão usa o maior entre a média real de poupança e este valor × a
-- percentagem para a mota. Em salário fixo usa-se o próprio salário.
-- Só acrescenta uma coluna; não mexe nos dados existentes.
--
-- Rollback: alter table public.work_settings drop column if exists minimum_monthly_pay_cents;
-- =============================================================================

alter table public.work_settings
  add column if not exists minimum_monthly_pay_cents integer
  check (minimum_monthly_pay_cents between 0 and 100000000);

comment on column public.work_settings.minimum_monthly_pay_cents is
  'Ordenado mínimo líquido por mês (cêntimos), mesmo com poucos turnos. Null = não definido.';
