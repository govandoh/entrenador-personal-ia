/**
 * Genera la migración que siembra `public.exercises` desde `src/domain/catalog.ts`
 * (los 60 ejercicios de DEC-040/056), para que el catálogo de la app y el de la base
 * no se desincronicen.
 *
 *   node scripts/generate-exercises-seed.ts           # escribe la migración
 *   node scripts/generate-exercises-seed.ts --check   # solo verifica que esté al día
 *
 * Usa `on conflict do update`: si el catálogo cambia, se vuelve a generar con otro nombre
 * de archivo (una migración nueva) y no se edita la ya aplicada.
 *
 * Node ≥ 22.18 ejecuta TypeScript con type stripping, por eso los imports llevan `.ts`.
 */

import { readFileSync, writeFileSync } from 'node:fs';

import { EXERCISE_CATALOG } from '../src/domain/catalog.ts';

const OUT = new URL('../supabase/migrations/20261010000200_seed_exercises.sql', import.meta.url);
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

function main(): number {
  const next = render();
  if (CHECK_ONLY) {
    let current = '';
    try {
      // Normalizar CRLF: en Windows git convierte los finales de línea al hacer checkout.
      current = readFileSync(OUT, 'utf8').replaceAll('\r\n', '\n');
    } catch {
      // archivo ausente: se reporta como desactualizado
    }
    if (current !== next) {
      console.error('La migración de seed de exercises está desactualizada: ejecuta `pnpm seed:exercises`.');
      return 1;
    }
    console.log(`Seed de exercises al día (${EXERCISE_CATALOG.length} ejercicios).`);
    return 0;
  }
  writeFileSync(OUT, next);
  console.log(`Escrito ${OUT.pathname} (${EXERCISE_CATALOG.length} ejercicios).`);
  return 0;
}

process.exitCode = main();
