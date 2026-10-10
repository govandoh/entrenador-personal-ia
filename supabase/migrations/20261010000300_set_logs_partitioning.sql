-- Partición mensual de set_logs con pg_partman, mantenida por pg_cron (issue #17).
-- Requiere las extensiones pg_partman y pg_cron del plan Free de Supabase. Si alguna no
-- está disponible, esta migración se descarta y set_logs queda con su partición `default`
-- (funciona igual; solo pierde la poda por mes). Ver docs/adr/ si se toma esa decisión.

create schema if not exists partman;
create extension if not exists pg_partman with schema partman;
create extension if not exists pg_cron;

-- Premake de 3 meses: siempre hay partición para los próximos meses aunque el job falle.
select partman.create_parent(
  p_parent_table => 'public.set_logs',
  p_control      => 'started_at',
  p_interval     => '1 month',
  p_premake      => 3,
  -- Ya existe `set_logs_default` (0000); pg_partman intentaría crearla otra vez.
  p_default_table => false
);

-- Las particiones nuevas no heredan RLS ni privilegios (ver 0100): se endurecen al crearlas.
select private.harden_set_logs_partitions();

-- Mantenimiento diario: crea las particiones futuras. Sin política de retención: las
-- series son datos del usuario y solo se borran por petición suya (DATA-GOVERNANCE §3).
select cron.schedule(
  'partman-maintenance',
  '0 3 * * *',
  $$call partman.run_maintenance_proc()$$
);

-- Endurecimiento 5 minutos después, en un job aparte: run_maintenance_proc hace COMMIT
-- internamente y no puede compartir transacción con otra sentencia. En esa ventana solo
-- puede estar expuesta una partición vacía de un mes futuro (premake de 3 meses).
select cron.schedule(
  'set-logs-harden-partitions',
  '5 3 * * *',
  $$select private.harden_set_logs_partitions()$$
);
