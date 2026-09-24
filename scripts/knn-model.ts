/**
 * Construye y evalúa el modelo k-NN de posturas a partir de grabaciones por guion (DEC-055).
 *
 *   node scripts/knn-model.ts <carpeta>                  # solo reporte LOSO
 *   node scripts/knn-model.ts <carpeta> --out <archivo>  # además escribe el modelo JSON
 *
 * Lee todos los `.json` de la carpeta (recursivo, salvo `index.json`), los reproduce con el
 * mismo pipeline 3D de la app y evalúa dejando fuera a un sujeto por vez. Las grabaciones
 * sin `world` (fixtures 2D del PR 1) se ignoran. El modelo NO se publica aquí: promoverlo
 * a la app pasa por el gate de `models/manifest.json` (`/promote-model`).
 *
 * Node ≥ 22.18 ejecuta TypeScript con type stripping, por eso los imports llevan `.ts`.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { evaluateLoso, samplesFromRecording, type LosoReport, type SubjectSample } from '../src/analysis/knnDataset.ts';
import { KnnPoseClassifier } from '../src/analysis/poseClassifier.ts';
import { POSE_EMBEDDING_VERSION } from '../src/geometry/poseEmbedding.ts';
import type { LandmarkFixture } from '../src/testing/fixtureTypes.ts';

function listJson(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listJson(path);
    return name.endsWith('.json') && name !== 'index.json' ? [path] : [];
  });
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)} %`;
}

function printReport(title: string, r: LosoReport): void {
  console.log(`\n${title}: ${r.samples} ejemplos, ${r.subjects.length} sujetos (${r.subjects.join(', ')})`);
  if (r.subjects.length < 2) {
    console.log('  Hace falta al menos 2 sujetos para evaluar LOSO.');
    return;
  }
  console.log(`  accuracy ${pct(r.accuracy)} · F1 macro ${r.f1Macro.toFixed(3)}`);
  for (const [label, c] of Object.entries(r.perClass)) {
    console.log(`  ${label.padEnd(18)} F1 ${c.f1.toFixed(3)}  precisión ${pct(c.precision)}  recall ${pct(c.recall)}  (n=${c.support})`);
  }
}

function main(): number {
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith('--'));
  const outIndex = args.indexOf('--out');
  const out = outIndex >= 0 ? args[outIndex + 1] : undefined;
  if (!dir) {
    console.error('Uso: node scripts/knn-model.ts <carpeta> [--out <archivo.json>]');
    return 2;
  }

  const form: Record<string, SubjectSample[]> = {};
  const exerciseId: SubjectSample[] = [];
  let used = 0;
  let skipped = 0;
  for (const path of listJson(dir)) {
    const fixture = JSON.parse(readFileSync(path, 'utf8')) as LandmarkFixture;
    const r = samplesFromRecording(fixture);
    if (!r) { skipped++; continue; }
    used++;
    (form[r.exercise] ??= []).push(...r.form);
    exerciseId.push(...r.exercise_id);
    console.log(`${path}: ${r.exercise} · ${fixture.meta.quality} · sujeto ${r.subjectId} · ${r.reps} reps`);
  }
  console.log(`\n${used} grabaciones usadas, ${skipped} ignoradas (sin world).`);
  if (used === 0) return 1;

  const reports: Record<string, LosoReport> = {};
  for (const [exercise, samples] of Object.entries(form)) {
    reports[exercise] = evaluateLoso(samples);
    printReport(`Errores de forma · ${exercise}`, reports[exercise]);
  }
  reports.exercise_id = evaluateLoso(exerciseId);
  printReport('Identificación de ejercicio', reports.exercise_id);

  if (out) {
    const model = {
      kind: 'knn-pose-bundle',
      embeddingVersion: POSE_EMBEDDING_VERSION,
      createdAt: new Date().toISOString(),
      exerciseId: new KnnPoseClassifier().fit(exerciseId).toJSON(),
      form: Object.fromEntries(Object.entries(form).map(([ex, s]) => [ex, new KnnPoseClassifier().fit(s).toJSON()])),
      loso: reports,
    };
    writeFileSync(out, JSON.stringify(model));
    console.log(`\nModelo escrito en ${out}`);
  }
  return 0;
}

process.exit(main());
