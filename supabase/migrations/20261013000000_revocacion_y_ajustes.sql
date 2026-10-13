-- Ajustes tras la revisión del PR #51 (issue #17).

-- Revocar un consentimiento deja de ser solo una marca: su grabación pasa a estar vencida
-- en ese instante (`retention_until = now()`). El job nocturno de purga y la exportación
-- para ML filtran por `retention_until`, así que excluyen la grabación sin lógica extra
-- (DATA-GOVERNANCE §3, DEC-064). SECURITY DEFINER: el cliente no puede actualizar
-- `retention_until` (0100 solo le deja editar las etiquetas).
create or replace function private.guard_consent_revocation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'un consentimiento revocado no se puede modificar';
  end if;
  if old.revoked_at is null and new.revoked_at is not null then
    update public.recordings
       set retention_until = least(retention_until, now())
     where consent_id = new.id;
  end if;
  return new;
end $$;

-- Mismas vistas que el esquema de fixtures (`FixtureView` en src/testing/fixtureTypes.ts).
alter table public.recordings
  add constraint recordings_view_check check (view in ('side', 'front', '45'));

-- La app usa la cámara trasera por defecto (`WorkoutScreen`); la base decía 'user'.
alter table public.profiles alter column preferred_camera set default 'environment';
