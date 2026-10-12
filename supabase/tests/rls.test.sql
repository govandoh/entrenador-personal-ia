-- Tests de RLS con pgTAP. Se ejecutan con `pnpm db:test` (supabase test db).
-- Criterio de la issue #17: un usuario no lee ni escribe datos de otro.
begin;
select plan(32);

-- Dos usuarios y un anónimo. Las filas se crean como superusuario (sin RLS).
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local');

insert into public.profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'Ana'),
  ('00000000-0000-0000-0000-00000000000b', 'Beto');

insert into public.workout_sessions (id, user_id) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b');

insert into public.set_logs (user_id, session_id, exercise_id, reps) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'sentadilla', 10),
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'sentadilla', 8);

insert into public.metrics (user_id, session_id, scope, name, value, unit) values
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'session', 'form_score', 80, 'pct');

insert into public.recording_consents (id, user_id, text_version) values
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'v1'),
  ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'v1');

-- ── Usuario A ───────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select count(*)::int from public.profiles), 1, 'A solo ve su perfil');
select is((select count(*)::int from public.workout_sessions), 1, 'A solo ve su sesión');
select is((select count(*)::int from public.set_logs), 1, 'A solo ve sus series');
select is((select count(*)::int from public.metrics), 0, 'A no ve métricas de B');
select is((select count(*)::int from public.recording_consents), 1, 'A solo ve su consentimiento');
select is((select count(*)::int from public.exercises), 60, 'A lee el catálogo completo');

select throws_ok(
  $$insert into public.profiles (user_id, display_name) values ('00000000-0000-0000-0000-00000000000b', 'Intruso')$$,
  '42501', null, 'A no puede crear el perfil de B');

select throws_ok(
  $$insert into public.set_logs (user_id, session_id, exercise_id)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000b', 'sentadilla')$$,
  '42501', null, 'A no puede colgar una serie de la sesión de B');

select throws_ok(
  $$insert into public.set_logs (user_id, session_id, exercise_id)
    values ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'sentadilla')$$,
  '42501', null, 'A no puede crear series a nombre de B');

select throws_ok(
  $$insert into public.recordings (user_id, consent_id, exercise_id, view, storage_path)
    values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000b', 'sentadilla', 'front', 'a/1.json')$$,
  '42501', null, 'A no puede grabar con el consentimiento de B');

select lives_ok(
  $$insert into public.recordings (user_id, consent_id, exercise_id, view, storage_path)
    values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'sentadilla', 'front', 'a/1.json')$$,
  'A graba con su consentimiento vigente');

select throws_ok(
  $$insert into public.recordings (user_id, consent_id, exercise_id, view, storage_path)
    values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'sentadilla', 'front', 'a/dup.json')$$,
  '23505', null, 'un consentimiento no sirve para dos grabaciones');

-- UPDATE/DELETE sobre filas ajenas no falla: RLS las oculta y afecta 0 filas.
update public.profiles set display_name = 'Hackeado' where user_id = '00000000-0000-0000-0000-00000000000b';
delete from public.workout_sessions where id = '10000000-0000-0000-0000-00000000000b';

select throws_ok(
  $$insert into public.exercises (id, name_es, muscle_group, base_difficulty, tracking, movement_pattern, equipment, equipment_label, cues)
    values ('x', 'x', 'core', 'bajo', 'reps', 'core', '[]', 'x', 'x')$$,
  '42501', null, 'A no puede escribir el catálogo');

-- Privilegios que RLS no cubre.
select throws_ok($$truncate public.set_logs$$, '42501', null, 'A no puede hacer TRUNCATE de series');
select throws_ok($$select * from public.set_logs_default$$, '42501', null,
  'A no puede consultar una partición de set_logs directamente');
select is(
  (select count(*)::int from pg_inherits i
   where i.inhparent = 'public.set_logs'::regclass
     and (has_table_privilege('authenticated', i.inhrelid, 'select,insert,update,delete')
          or has_table_privilege('anon', i.inhrelid, 'select,insert,update,delete')
          or not (select relrowsecurity from pg_class where oid = i.inhrelid))),
  0, 'ninguna partición de set_logs queda expuesta ni sin RLS');
select throws_ok(
  $$update public.recordings set retention_until = now() + interval '100 years'$$,
  '42501', null, 'A no puede ampliar la retención de su grabación');
select throws_ok(
  $$insert into public.recording_consents (user_id, text_version, granted_at)
    values ('00000000-0000-0000-0000-00000000000a', 'v1', now() - interval '1 year')$$,
  '42501', null, 'A no puede fijar granted_at de un consentimiento');
select throws_ok($$delete from public.recording_consents$$, '42501', null, 'A no puede borrar consentimientos');

-- Revocar el consentimiento bloquea nuevas grabaciones y es definitivo.
update public.recording_consents set revoked_at = now() where id = '20000000-0000-0000-0000-00000000000a';
select throws_ok(
  $$insert into public.recordings (user_id, consent_id, exercise_id, view, storage_path)
    values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'sentadilla', 'front', 'a/2.json')$$,
  '42501', null, 'con el consentimiento revocado no se pueden crear grabaciones');
select throws_ok(
  $$update public.recording_consents set revoked_at = null where id = '20000000-0000-0000-0000-00000000000a'$$,
  'P0001', null, 'una revocación no se puede deshacer');

select is((select count(*)::int from public.recordings), 1, 'A puede ver (y borrar) su grabación ya creada');

-- ── Usuario B: lo de A no le afectó ni lo ve ────────────────────────────────
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select is((select display_name from public.profiles), 'Beto', 'el UPDATE de A no tocó el perfil de B');
select is((select count(*)::int from public.workout_sessions), 1, 'el DELETE de A no borró la sesión de B');
select is((select count(*)::int from public.metrics), 1, 'B ve sus métricas');
select is((select count(*)::int from public.recordings), 0, 'B no ve grabaciones de A');
select is((select count(*)::int from public.set_logs), 1, 'B solo ve sus series');

-- ── Anónimo ─────────────────────────────────────────────────────────────────
set local role anon;
set local request.jwt.claims to '';

-- anon no tiene privilegios sobre ninguna tabla de public.
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon no lee perfiles');
select throws_ok($$select * from public.set_logs$$, '42501', null, 'anon no lee series');
select throws_ok($$select * from public.exercises$$, '42501', null, 'anon no lee el catálogo');
select throws_ok($$select * from public.set_logs_default$$, '42501', null, 'anon no lee particiones');
-- La única puerta de anon es el ping de keepalive.
select is((select public.keepalive() is not null), true, 'anon puede llamar a keepalive()');

select * from finish();
rollback;
