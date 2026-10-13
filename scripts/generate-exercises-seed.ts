/**
 * Genera la migración que siembra `public.exercises` desde `src/domain/catalog.ts`
 * (los 60 ejercicios de DEC-040/056), para que el catálogo de la app y el de la base
 * no se desincronicen.
 *
 *   node scripts/generate-exercises-seed.ts           # crea una migración nueva si el catálogo cambió
 *   node scripts/generate-exercises-seed.ts --check   # verifica que la última migración de seed esté al día
 *
 * Una migración ya aplicada nunca se reescribe (Supabase no vuelve a ejecutarla): si el
 * catálogo cambió, se crea `<fecha>_seed_exercises.sql` con el catálogo completo y
 * `on conflict do update`. La verificación compara contra la migración de seed MÁS
 * RECIENTE. Los ejercicios que se quiten del catálogo no se borran de la base (las series
 * guardadas los referencian): se tratan con una migración escrita a mano.
 *
 * Node ≥ 22.18 ejecuta TypeScript con type stripping, por eso los imports llevan `.ts`.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

import { EXERCISE_CATALOG } from '../src/domain/catalog.ts';

const MIGRATIONS = new URL('../supabase/migrations/', import.meta.url);
const SEED_FILE = /^(\d{14})_seed_exercises\.sql$/;
const CHECK_ONLY = process.argv.includes('--check');

const quote = (s: string): string => `'${s.replaceAll("'", "''")}'`;
const textArray = (items: readonly string[]): string =>
  items.length === 0 ? `'{}'` : `array[${items.map(quote).join(', ')}]`;

function render(): string {
  const rows = EXERCISE_CATALOG.map(e => `  (${[
    quote(e.id),
    quote(e.name),
    quote(e.muscleGroup),
    textArray(e.secondary),
    quote(e.baseDifficulty),
    quote(e.tracking),
    e.assistant ? quote(e.assistant) : 'null',
    quote(e.pattern),
    `${quote(JSON.stringify(e.equipment))}::jsonb`,
    quote(e.equipmentLabel),
    quote(e.cues),
  ].join(', ')})`);

  return [
    '-- GENERADO por scripts/generate-exercises-seed.ts desde src/domain/catalog.ts. No editar a mano.',
    `-- ${EXERCISE_CATALOG.length} ejercicios (DEC-040, DEC-056).`,
    'insert into public.exercises',
    '  (id, name_es, muscle_group, secondary, base_difficulty, tracking, assistant, movement_pattern, equipment, equipment_label, cues)',
    'values',
    rows.join(',\n'),
    'on conflict (id) do update set',
    '  name_es = excluded.name_es, muscle_group = excluded.muscle_group, secondary = excluded.secondary,',
    '  base_difficulty = excluded.base_difficulty, tracking = excluded.tracking, assistant = excluded.assistant,',
    '  movement_pattern = excluded.movement_pattern, equipment = excluded.equipment,',
    '  equipment_label = excluded.equipment_label, cues = excluded.cues;',
    '',
  ].join('\n');
}

/** Marca de tiempo UTC `YYYYMMDDHHMMSS`, el formato de las migraciones de Supabase. */
function stamp(date: Date): string {
  return date.toISOString().replaceAll(/[-:T]/g, '').slice(0, 14);
}

function main(): number {
  const files = readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort();
  const latestSeed = files.filter(f => SEED_FILE.test(f)).at(-1);
  const next = render();

  // Normalizar CRLF: en Windows git convierte los finales de línea al hacer checkout.
  const current = latestSeed
    ? readFileSync(new URL(latestSeed, MIGRATIONS), 'utf8').replaceAll('\r\n', '\n')
    : null;

  if (current === next) {
    console.log(`Seed de exercises al día (${EXERCISE_CATALOG.length} ejercicios, ${latestSeed}).`);
    return 0;
  }
  if (CHECK_ONLY) {
    console.error('El catálogo cambió y falta su migración de seed: ejecuta `pnpm seed:exercises`.');
    return 1;
  }

  // La nueva migración debe ordenar después de TODAS las existentes, incluso si el reloj
  // local va por detrás de la fecha de alguna.
  const floor = String(BigInt(files.at(-1)?.slice(0, 14) ?? '0') + 1n);
  const now = stamp(new Date());
  const name = `${now > floor ? now : floor}_seed_exercises.sql`;
  writeFileSync(new URL(name, MIGRATIONS), next);
  console.log(`Creada supabase/migrations/${name} (${EXERCISE_CATALOG.length} ejercicios).`);
  return 0;
}

process.exitCode = main();
