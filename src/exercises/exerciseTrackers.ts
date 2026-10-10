import type {
  ExerciseId, ExerciseTracker, FeedbackLevel, Landmark, LandmarkFrame, RepEvent, TrackerOutput,
} from '../contracts/index.ts';
import type { Landmark3D } from '../geometry/vectors3d.ts';
import type { FramePipeline } from '../analysis/framePipeline.ts';
import { SquatTracker } from './squat.ts';
import { BicepCurlTracker } from './bicepCurl.ts';
import { ShoulderPressTracker } from './shoulderPress.ts';
import { PlankTracker, type PlankResult } from './plankTracker.ts';
import type { ExerciseDefinition3D, Tracker3DResult } from './tracker3d.ts';

/**
 * Adaptadores de los contadores al contrato `ExerciseTracker` (DEC-063, issue #11).
 *
 * Finos a propósito: no cambian el comportamiento de ningún contador (los golden del PR 1
 * siguen probando los originales); solo traducen su salida a `TrackerOutput`:
 * - 2D: `atBottom`/`atTop`/`atPeak` → `peak`; aumento de `reps` → `complete`.
 * - 3D: `peak`, `repCounted` y `rejection` de `Tracker3D` → `peak`, `complete`, `rejected`.
 * - Plancha: sin eventos (no hay ciclo); el tiempo sostenido va en `detail`.
 *
 * Lo propio de cada motor que necesita la pantalla (el resultado completo para el resumen
 * de la serie y los landmarks procesados para el mini mapa) va en `detail`, fuera del
 * contrato: si otro consumidor lo necesitara, se sube al contrato con su DEC.
 */

export type EngineDetail =
  | { engine: '2d' }
  | { engine: '3d'; result: Tracker3DResult; world: Landmark3D[] }
  | { engine: 'hold'; result: PlankResult; world: Landmark3D[] }
  /** El contador mide sobre `world` y el frame no lo traía: no midió nada. */
  | { engine: 'none' };

export interface EngineOutput extends TrackerOutput {
  detail: EngineDetail;
}

export interface EngineTracker extends ExerciseTracker {
  update(frame: LandmarkFrame): EngineOutput;
}

// ─── Motor 2D (producción hasta la DEC de #33) ───────────────────────────────

interface Result2D {
  phase: string;
  reps: number;
  feedbackLevel: FeedbackLevel;
  feedbackMessage: string;
}

interface Tracker2D<R extends Result2D> {
  update(landmarks: Landmark[]): R;
  reset(): void;
}

const DETAIL_2D: EngineDetail = { engine: '2d' };
const DETAIL_NONE: EngineDetail = { engine: 'none' };

class Tracker2DAdapter<R extends Result2D> implements EngineTracker {
  readonly exerciseId: ExerciseId;
  private readonly tracker: Tracker2D<R>;
  private readonly peakAngle: (r: R) => number | null;
  private reps = 0;

  /** `peakAngle`: extremo del ciclo si en este frame se confirmó el pico o fondo; si no, `null`. */
  constructor(exerciseId: ExerciseId, tracker: Tracker2D<R>, peakAngle: (r: R) => number | null) {
    this.exerciseId = exerciseId;
    this.tracker = tracker;
    this.peakAngle = peakAngle;
  }

  update(frame: LandmarkFrame): EngineOutput {
    const r = this.tracker.update(frame.image);
    const events: RepEvent[] = [];
    const extreme = this.peakAngle(r);
    if (extreme !== null) events.push({ kind: 'peak', t: frame.t, extremeAngle: extreme });
    if (r.reps > this.reps) events.push({ kind: 'complete', t: frame.t });
    this.reps = r.reps;
    return {
      phase: r.phase, reps: r.reps, feedbackLevel: r.feedbackLevel, feedbackMessage: r.feedbackMessage,
      events, detail: DETAIL_2D,
    };
  }

  reset(): void {
    this.tracker.reset();
    this.reps = 0;
  }
}

export function squat2D(): EngineTracker {
  return new Tracker2DAdapter('squat', new SquatTracker(), r => (r.atBottom ? r.minAngleReached : null));
}

export function curl2D(): EngineTracker {
  return new Tracker2DAdapter('curl', new BicepCurlTracker(), r => (r.atTop ? r.minAngleReached : null));
}

export function press2D(): EngineTracker {
  return new Tracker2DAdapter('press', new ShoulderPressTracker(), r => (r.atPeak ? r.maxAngleReached : null));
}

// ─── Motor 3D (DEC-057) ──────────────────────────────────────────────────────

/** Activa `def` en el pipeline si no lo estaba (contador nuevo, misma calibración). */
function ensureDefinition(pipeline: FramePipeline, def: ExerciseDefinition3D): void {
  if (pipeline.definition !== def) pipeline.setExercise(def);
}

/**
 * Contador 3D sobre un `FramePipeline` compartido por todos los ejercicios 3D, para que
 * la calibración de pie sobreviva al cambio de ejercicio. `reset()` activa la definición
 * de este ejercicio; si ya estaba activa, el contador interno del motor sigue acumulando
 * entre series, como antes del contrato (la calibración del press depende de él, DEC-053).
 * `reps` cuenta solo la serie en curso.
 */
export class Engine3DTracker implements EngineTracker {
  readonly exerciseId: ExerciseId;
  private readonly pipeline: FramePipeline;
  private readonly def: ExerciseDefinition3D;
  private reps = 0;

  constructor(exerciseId: ExerciseId, pipeline: FramePipeline, def: ExerciseDefinition3D) {
    this.exerciseId = exerciseId;
    this.pipeline = pipeline;
    this.def = def;
  }

  update(frame: LandmarkFrame): EngineOutput {
    if (!frame.world) return notMeasured(this.reps, this.def.notVisibleMessage);
    const { world, result: r } = this.pipeline.process({ world: frame.world, t: frame.t, worldDown: frame.down });
    const events: RepEvent[] = [];
    if (r.peak) events.push({ kind: 'peak', t: frame.t, extremeAngle: r.extremeDeg });
    if (r.repCounted) {
      this.reps++;
      events.push({ kind: 'complete', t: frame.t });
    }
    if (r.rejection) events.push({ kind: 'rejected', t: frame.t, reason: r.rejection, message: r.rejectionMessage ?? '' });
    return {
      phase: r.phase, reps: this.reps, feedbackLevel: r.feedbackLevel, feedbackMessage: r.feedbackMessage,
      events, detail: { engine: '3d', result: r, world },
    };
  }

  reset(): void {
    ensureDefinition(this.pipeline, this.def);
    this.reps = 0;
  }
}

/**
 * Plancha: no cuenta ciclos, así que usa solo los pasos de preparación del pipeline
 * compartido (suavizado, nivelación y calibración) con la configuración de `calibrationDef`.
 */
export class PlankExerciseTracker implements EngineTracker {
  readonly exerciseId = 'plank';
  private readonly pipeline: FramePipeline;
  private readonly calibrationDef: ExerciseDefinition3D;
  private readonly plank = new PlankTracker();

  constructor(pipeline: FramePipeline, calibrationDef: ExerciseDefinition3D) {
    this.pipeline = pipeline;
    this.calibrationDef = calibrationDef;
  }

  update(frame: LandmarkFrame): EngineOutput {
    if (!frame.world) return notMeasured(0, '');
    const { world } = this.pipeline.prepare({ world: frame.world, t: frame.t, worldDown: frame.down });
    const r = this.plank.update(world, frame.t);
    return {
      phase: r.holding ? 'holding' : 'paused', reps: 0,
      feedbackLevel: r.feedbackLevel, feedbackMessage: r.feedbackMessage,
      events: [], detail: { engine: 'hold', result: r, world },
    };
  }

  reset(): void {
    this.plank.reset();
    ensureDefinition(this.pipeline, this.calibrationDef);
  }
}

function notMeasured(reps: number, message: string): EngineOutput {
  return { phase: 'rest', reps, feedbackLevel: 'idle', feedbackMessage: message, events: [], detail: DETAIL_NONE };
}
