/**
 * Genera los fixtures sintéticos de `fixtures/landmarks/` y actualiza `index.json`.
 *
 *   node scripts/gen-synthetic-fixtures.ts          # escribe archivos
 *   node scripts/gen-synthetic-fixtures.ts --check  # solo verifica que los archivos estén al día
 *
 * Node ≥ 22.18 ejecuta TypeScript con type stripping, por eso los imports llevan `.ts`.
 * La generación es determinista (semilla fija para el ruido, fecha fija en meta), así que
 * regenerar sobre un árbol limpio no produce cambios en git.
 *
 * Las entradas del índice con `source: 'phone'` se conservan tal cual: las grabaciones
 * reales se registran a mano (ver fixtures/README.md).
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildAllSyntheticFixtures,
  serializeFixture,
  toIndexEntry,
  toLandmarkFixture,
  verifyFixtureAngles,
} from '../src/testing/syntheticFixtures.ts';
import { FIXTURE_SCHEMA_VERSION, type FixtureIndex, type FixtureIndexEntry } from '../src/testing/fixtureTypes.ts';

const ROOT        = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR     = join(ROOT, 'fixtures', 'landmarks');
const INDEX_PATH  = join(OUT_DIR, 'index.json');
const CHECK_ONLY  = process.argv.includes('--check');

function readExistingIndex(): FixtureIndex {
  if (!existsSync(INDEX_PATH)) return { schemaVersion: FIXTURE_SCHEMA_VERSION, fixtures: [] };
  return JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as FixtureIndex;
}

function main(): number {
  const fixtures = buildAllSyntheticFixtures();

  // 1. Verificación geométrica: calculateAngle reproduce el ángulo objetivo en cada frame.
  const errors = fixtures.flatMap(verifyFixtureAngles);
  if (errors.length > 0) {
    console.error(`✗ ${errors.length} frame(s) fuera de tolerancia:`);
    for (const e of errors.slice(0, 20)) console.error('  ' + e);
    if (errors.length > 20) console.error(`  … y ${errors.length - 20} más`);
    return 1;
  }

  // 2. Índice: conservar entradas no sintéticas, reemplazar las sintéticas.
  const existing = readExistingIndex();
  const phoneEntries: FixtureIndexEntry[] = existing.fixtures.filter(e => e.source !== 'synthetic');
  const index: FixtureIndex = {
    schemaVersion: FIXTURE_SCHEMA_VERSION,
    fixtures: [...fixtures.map(toIndexEntry), ...phoneEntries],
  };

  const outputs: { path: string; content: string }[] = fixtures.map(f => ({
    path:    join(OUT_DIR, f.file),
    content: serializeFixture(toLandmarkFixture(f)),
  }));
  outputs.push({ path: INDEX_PATH, content: JSON.stringify(index, null, 2) + '\n' });

  if (CHECK_ONLY) {
    // Normalizar CRLF: en Windows git convierte los finales de línea al hacer checkout.
    const norm  = (s: string) => s.replace(/\r\n/g, '\n');
    const stale = outputs.filter(o => !existsSync(o.path) || norm(readFileSync(o.path, 'utf8')) !== norm(o.content));
    if (stale.length > 0) {
      console.error('✗ Fixtures desactualizados (ejecuta `pnpm fixtures:gen`):');
      for (const s of stale) console.error('  ' + s.path);
      return 1;
    }
    console.log(`✓ ${fixtures.length} fixtures sintéticos al día`);
    return 0;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (const o of outputs) writeFileSync(o.path, o.content, 'utf8');

  for (const f of fixtures) {
    console.log(`✓ ${f.file.padEnd(32)} ${String(f.frames.length).padStart(4)} frames @ ${f.meta.fps} fps  esperado: ${JSON.stringify(f.expected)}`);
  }
  console.log(`✓ index.json (${index.fixtures.length} entradas, ${phoneEntries.length} de celular conservadas)`);
  return 0;
}

process.exitCode = main();
