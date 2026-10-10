-- Esquema inicial de Fitnet (issue #17, DEC-029).
-- Modelo de dominio: docs/DOMAIN.md. Acceso y RLS: docs/DATA-GOVERNANCE.md §4.
-- Los valores permitidos de los campos de texto replican los tipos de src/domain/
-- (routineGenerator.ts, catalog.ts); si cambian allí, hay que migrar aquí.

-- ── Perfil y objetivos ──────────────────────────────────────────────────────

create table public.profiles (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  display_name     text not null check (char_length(display_name) between 1 and 60),
  birth_year       smallint check (birth_year between 1900 and 2100),
  height_cm        numeric(5, 1) check (height_cm > 0),
  weight_kg        numeric(5, 1) check (weight_kg > 0),
  experience_level text not null default 'beginner'
                   check (experience_level in ('beginner', 'intermediate', 'advanced')),
  goal             text not null default 'muscle_gain'
                   check (goal in ('muscle_gain', 'weight_loss', 'strength_gain')),
  training_location text not null default 'gym_full'
                   check (training_location in ('gym_full', 'home_none', 'home_limited')),
  equipment        text[] not null default '{}',
  days_per_week    smallint not null default 3 check (days_per_week between 2 and 6),
  session_minutes  smallint not null default 45 check (session_minutes between 10 and 240),
  program_type     text not null default 'full_body'
                   check (program_type in ('full_body', 'upper_lower', 'ppl')),
  preferred_camera text not null default 'user' check (preferred_camera in ('user', 'environment')),
  public_profile   boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  metric_name text not null,
  target      numeric not null,
  deadline    date,
  status      text not null default 'active' check (status in ('active', 'achieved', 'abandoned')),
  created_at  timestamptz not null default now()
);
create index goals_user_id_idx on public.goals (user_id);

-- ── Catálogo ────────────────────────────────────────────────────────────────

-- Los ids son los slugs de src/domain/catalog.ts (DEC-040, DEC-056). Se siembra con
-- scripts/generate-exercises-seed.ts; no se edita a mano.
create table public.exercises (
  id               text primary key,
  name_es          text not null,
  muscle_group     text not null,
  secondary        text[] not null default '{}',
  base_difficulty  text not null check (base_difficulty in ('bajo', 'medio', 'alto')),
  tracking         text not null check (tracking in ('camera', 'reps', 'time')),
  assistant        text,
  movement_pattern text not null,
  -- Opciones de equipo: [["barbell","bench"],["dumbbell","bench"]]. jsonb porque un
  -- text[][] de Postgres exige subarreglos del mismo largo.
  equipment        jsonb not null,
  equipment_label  text not null,
  cues             text not null
);

-- ── Sesiones, series y métricas ─────────────────────────────────────────────

create table public.workout_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  -- Sin FK: las rutinas guardadas en la nube llegan con #34/#35.
  routine_day_id uuid,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  device         text,
  -- Versiones de models/manifest.json usadas en la sesión.
  model_versions jsonb not null default '{}',
  check (ended_at is null or ended_at >= started_at)
);
create index workout_sessions_user_started_idx on public.workout_sessions (user_id, started_at desc);

-- Particionada por mes sobre started_at. La clave primaria incluye la columna de
-- partición (requisito de Postgres). `user_id` va denormalizado para que la política
-- RLS no necesite un join con workout_sessions en cada fila.
create table public.set_logs (
  id          uuid not null default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  session_id  uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  method      text not null default 'normal'
              check (method in ('normal', 'rest_pause', 'dropset', 'superset')),
  method_params jsonb not null default '{}',
  load_kg     numeric(6, 2) check (load_kg >= 0),
  rpe         numeric(3, 1) check (rpe between 1 and 10),
  reps        smallint check (reps >= 0),
  started_at  timestamptz not null default now(),
  primary key (id, started_at)
) partition by range (started_at);
create index set_logs_session_idx on public.set_logs (session_id);
create index set_logs_user_started_idx on public.set_logs (user_id, started_at desc);
-- Partición de respaldo: ninguna inserción falla si falta la partición del mes.
create table public.set_logs_default partition of public.set_logs default;

-- Valor agregado con nombre (docs/METRICS.md); única entrada del CoachAssistant.
-- `set_id` no tiene FK: una FK hacia una tabla particionada exigiría también started_at.
create table public.metrics (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  session_id     uuid not null references public.workout_sessions (id) on delete cascade,
  set_id         uuid,
  scope          text not null check (scope in ('set', 'session')),
  name           text not null,
  value          double precision not null,
  unit           text not null,
  schema_version smallint not null default 1,
  computed_at    timestamptz not null default now()
);
create index metrics_session_idx on public.metrics (session_id);
create index metrics_user_name_idx on public.metrics (user_id, name, computed_at desc);

-- ── Consentimiento y grabaciones (DATA-GOVERNANCE §2) ───────────────────────

create table public.recording_consents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  scope        text not null default 'training_dataset' check (scope = 'training_dataset'),
  text_version text not null,
  granted_at   timestamptz not null default now(),
  revoked_at   timestamptz
);
create index recording_consents_user_idx on public.recording_consents (user_id);

create table public.recordings (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  -- Un consentimiento por grabación (DATA-GOVERNANCE §2): único.
  consent_id     uuid not null unique references public.recording_consents (id),
  exercise_id    text not null references public.exercises (id),
  view           text not null,
  device         text,
  schema_version smallint not null default 1,
  storage_path   text not null,
  labels         text[] not null default '{}',
  -- Por defecto 24 meses desde la grabación (DATA-GOVERNANCE §3).
  retention_until timestamptz not null default (now() + interval '24 months'),
  created_at     timestamptz not null default now()
);
create index recordings_user_idx on public.recordings (user_id);
create index recordings_retention_idx on public.recordings (retention_until);

-- ── Mantenimiento de updated_at ─────────────────────────────────────────────

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();
