-- Row Level Security en todas las tablas (DATA-GOVERNANCE §4).
-- Regla base: el dueño (user_id = auth.uid()) lee y escribe lo suyo; nadie más lee nada.
-- `(select auth.uid())` en vez de `auth.uid()` para que Postgres lo evalúe una vez por
-- consulta y no por fila. Las políticas de entrenadores (coaching_relationships) y
-- is_premium() llegan con sus tablas, en una migración posterior.

-- ── Privilegios ─────────────────────────────────────────────────────────────
-- RLS filtra filas, no cubre TRUNCATE, TRIGGER ni REFERENCES, y Supabase concede por
-- defecto todos los privilegios a anon/authenticated sobre las tablas de public. Se
-- recortan aquí y en los privilegios por defecto de las tablas futuras.
-- Fitnet no tiene acceso sin sesión: anon no recibe nada.
revoke all on all tables in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated;

-- Esquema no expuesto por la API para funciones de mantenimiento.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.profiles           enable row level security;
alter table public.goals              enable row level security;
alter table public.exercises          enable row level security;
alter table public.workout_sessions   enable row level security;
alter table public.set_logs           enable row level security;
alter table public.metrics            enable row level security;
alter table public.recording_consents enable row level security;
alter table public.recordings         enable row level security;

-- Catálogo: lectura para cualquier usuario autenticado; nadie lo escribe desde el
-- cliente (se siembra con migraciones).
create policy exercises_read on public.exercises
  for select to authenticated using (true);
revoke insert, update, delete on public.exercises from authenticated;

-- ── Particiones de set_logs ─────────────────────────────────────────────────
-- Ni RLS ni los privilegios se heredan a las particiones, y PostgREST expone cada una
-- como tabla propia: sin esto, GET /rest/v1/set_logs_default saltaría las políticas del
-- padre. Se les activa RLS (sin políticas = nada pasa) y se les quitan los privilegios.
-- La función se vuelve a ejecutar tras cada mantenimiento de pg_partman (ver 0300).
create function private.harden_set_logs_partitions() returns void
language plpgsql set search_path = '' as $$
declare
  part regclass;
begin
  for part in select inhrelid::regclass from pg_inherits where inhparent = 'public.set_logs'::regclass loop
    execute format('alter table %s enable row level security', part);
    execute format('revoke all on table %s from anon, authenticated', part);
  end loop;
end $$;
revoke all on function private.harden_set_logs_partitions() from public, anon, authenticated;
select private.harden_set_logs_partitions();

-- ── Tablas con dueño directo ────────────────────────────────────────────────

create policy profiles_owner on public.profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy goals_owner on public.goals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy workout_sessions_owner on public.workout_sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Series y métricas: además de ser del dueño, la sesión referenciada debe ser suya
-- (evita colgar filas de la sesión de otra persona).
create policy set_logs_owner on public.set_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );

create policy metrics_owner on public.metrics
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );

-- ── Consentimiento y grabaciones (DATA-GOVERNANCE §2, regla dura 2) ─────────
-- El consentimiento es un registro de trazabilidad: el usuario lo crea y lo revoca, pero
-- no lo reescribe ni lo borra. Los privilegios por columna fijan qué puede enviar el
-- cliente: `granted_at` e `id` los asigna la base.
revoke insert, update, delete on public.recording_consents from authenticated;
grant insert (user_id, scope, text_version) on public.recording_consents to authenticated;
grant update (revoked_at) on public.recording_consents to authenticated;

create policy recording_consents_select on public.recording_consents
  for select to authenticated using (user_id = (select auth.uid()));

create policy recording_consents_insert on public.recording_consents
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy recording_consents_revoke on public.recording_consents
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Una revocación es definitiva: no se puede reactivar ni cambiar la fecha.
create function private.guard_consent_revocation() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'un consentimiento revocado no se puede modificar';
  end if;
  return new;
end $$;
revoke all on function private.guard_consent_revocation() from public, anon, authenticated;

create trigger recording_consents_guard_revocation before update on public.recording_consents
  for each row execute function private.guard_consent_revocation();

-- Grabaciones: se leen y borran siempre (derecho de borrado); solo se crean con un
-- consentimiento propio y vigente. `retention_until` lo fija la base (24 meses): el
-- cliente solo puede editar las etiquetas.
revoke insert, update on public.recordings from authenticated;
grant insert (user_id, consent_id, exercise_id, view, device, schema_version, storage_path, labels)
  on public.recordings to authenticated;
grant update (labels) on public.recordings to authenticated;

create policy recordings_select on public.recordings
  for select to authenticated using (user_id = (select auth.uid()));

create policy recordings_delete on public.recordings
  for delete to authenticated using (user_id = (select auth.uid()));

create policy recordings_insert on public.recordings
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.recording_consents c
      where c.id = consent_id and c.user_id = (select auth.uid()) and c.revoked_at is null
    )
  );

create policy recordings_update on public.recordings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
