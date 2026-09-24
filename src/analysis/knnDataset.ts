import type { LandmarkFixture } from '../testing/fixtureTypes.ts';
import { FramePipeline } from './framePipeline.ts';
import { DEFINITIONS_3D, type Exercise3DId } from '../exercises/definitions3d.ts';
import { embedPose } from '../geometry/poseEmbedding.ts';
import { KnnPoseClassifier, type KnnOptions, type LabeledSample } from './poseClassifier.ts';

/**
 * De grabaciones etiquetadas por guion a ejemplos del k-NN, y evaluación LOSO (DEC-055).
 *
 * Cada grabación se reproduce con el MISMO pipeline de la app (`FramePipeline`: suavizado,
 * nivelación con la gravedad grabada en `down`, calibración, contador 3D). Así los
 * ejemplos salen exactamente como los verá el clasificador en vivo:
 *
 * - **Forma:** el frame clave de cada repetición (`keyFrame`, emitido en el pico o fondo)
 *   con la condición de la toma como etiqueta (`correct` o el código de error).
 * - **Ejercicio:** frames del esfuerzo cada `exerciseSampleMs`, etiquetados con el ejercicio.
 *
 * La evaluación deja fuera a un sujeto entero por vez (Leave-One-Subject-Out): nunca se
 * evalúa sobre alguien visto al entrenar (ML-PIPELINE.md §7).
 */

export interface SubjectSample extends LabeledSample {
  subjectId: string;
}

export interface RecordingSamples {
  exercise: Exercise3DId;
  subjectId: string;
  /** Frames clave etiquetados con la condición: entrenan el detector de errores del ejercicio. */
  form: SubjectSample[];
  /** Frames del esfuerzo etiquetados con el ejercicio: entrenan la identificación. */
  exercise_id: SubjectSample[];
  /** Repeticiones contadas por el motor 3D al reproducir la grabación. */
  reps: number;
}

/** Intervalo entre muestras de identificación de ejercicio, en ms. */
const DEFAULT_EXERCISE_SAMPLE_MS = 100;

/** Etiqueta de forma según la calidad del archivo: `good` → `correct`; si no, el código de error. */
export function formLabel(quality: string): string {
  return quality === 'good' ? 'correct' : quality;
}

/**
 * Reproduce una grabación con el pipeline de la app y extrae sus ejemplos. Devuelve `null`
 * si la grabación no tiene `world` (los fixtures sintéticos 2D del PR 1 no lo tienen).
 */
export function samplesFromRecording(
  fixture: LandmarkFixture,
  exerciseSampleMs = DEFAULT_EXERCISE_SAMPLE_MS,
): RecordingSamples | null {
  const exercise = fixture.meta.exercise as Exercise3DId;
  const def = DEFINITIONS_3D[exercise];
  if (!def || !fixture.frames.some(f => f.world)) return null;

  const subjectId = fixture.meta.capture?.subjectId ?? 'unknown';
  const label = formLabel(fixture.meta.quality);
  const pipeline = new FramePipeline(def);
  const form: SubjectSample[] = [];
  const exerciseId: SubjectSample[] = [];
  let lastExerciseSample = -Infinity;
  let reps = 0;

  for (const frame of fixture.frames) {
    if (!frame.world) continue;
    const down = frame.down ? { x: frame.down[0], y: frame.down[1], z: frame.down[2] } : null;
    const out = pipeline.process({ world: frame.world, t: frame.t, worldDown: down });
    const r = out.result;
    reps = r.reps;

    if (r.peak && r.keyFrame) {
      const e = embedPose(r.keyFrame);
      if (e) form.push({ label, embedding: e, subjectId });
    }
    if (r.visible && r.phase === 'effort' && frame.t - lastExerciseSample >= exerciseSampleMs) {
      const e = embedPose(out.world);
      if (e) {
        exerciseId.push({ label: exercise, embedding: e, subjectId });
        lastExerciseSample = frame.t;
      }
    }
  }
  return { exercise, subjectId, form, exercise_id: exerciseId, reps };
}

export interface ClassReport {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface LosoReport {
  subjects: string[];
  samples: number;
  accuracy: number;
  f1Macro: number;
  perClass: Record<string, ClassReport>;
  /** confusion[real][predicha] = cuántos ejemplos. */
  confusion: Record<string, Record<string, number>>;
}

/** Evaluación Leave-One-Subject-Out de un k-NN sobre ejemplos de varios sujetos. */
export function evaluateLoso(samples: readonly SubjectSample[], options: Partial<KnnOptions> = {}): LosoReport {
  const subjects = [...new Set(samples.map(s => s.subjectId))].sort();
  const labels = [...new Set(samples.map(s => s.label))].sort();
  const confusion: Record<string, Record<string, number>> = {};
  for (const a of labels) confusion[a] = Object.fromEntries(labels.map(b => [b, 0]));

  let hits = 0;
  let total = 0;
  for (const held of subjects) {
    const train = samples.filter(s => s.subjectId !== held);
    const test = samples.filter(s => s.subjectId === held);
    if (train.length === 0) continue;
    const knn = new KnnPoseClassifier(options).fit(train);
    for (const s of test) {
      const predicted = knn.predict(s.embedding).label ?? '';
      confusion[s.label][predicted] = (confusion[s.label][predicted] ?? 0) + 1;
      if (predicted === s.label) hits++;
      total++;
    }
  }

  const perClass: Record<string, ClassReport> = {};
  for (const l of labels) {
    const tp = confusion[l][l] ?? 0;
    const support = Object.values(confusion[l]).reduce((a, v) => a + v, 0);
    const predicted = labels.reduce((a, r) => a + (confusion[r][l] ?? 0), 0);
    const precision = predicted > 0 ? tp / predicted : 0;
    const recall = support > 0 ? tp / support : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    perClass[l] = { precision, recall, f1, support };
  }
  const f1Macro = labels.length > 0 ? labels.reduce((a, l) => a + perClass[l].f1, 0) / labels.length : 0;

  return { subjects, samples: total, accuracy: total > 0 ? hits / total : 0, f1Macro, perClass, confusion };
}
