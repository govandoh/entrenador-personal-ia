import type { Landmark3D, Vec3 } from '../geometry/vectors3d.ts';
import { LandmarkSmoother } from '../geometry/landmarkFilter.ts';
import { alignToGravityChecked } from '../geometry/gravityAlign.ts';
import { StandingCalibrator } from '../geometry/standingCalibration.ts';
import { Tracker3D, type ExerciseDefinition3D, type Tracker3DResult } from '../exercises/tracker3d.ts';

/**
 * Pipeline 3D por frame (ver DEC-057): suavizado → nivelación → calibración → contador.
 *
 * Es el orden de fitnetv2 (`CameraView`, commit 82e8783), sacado del componente para que
 * sea puro y se pueda probar sin cámara:
 *
 * 1. Filtro One Euro sobre los `worldLandmarks` (DEC-046).
 * 2. Nivelación con la gravedad del acelerómetro, si hay lectura (DEC-050).
 * 3. Calibración de la vertical con la postura de pie (DEC-053). Aprende solo en reposo
 *    y, en ejercicios con `calibrateDuringSet: false` (press), solo antes de la primera
 *    repetición de la serie: así no absorbe un arqueo moderado.
 * 4. Contador 3D del ejercicio activo (`Tracker3D`).
 *
 * No toca el DOM ni el reloj: el adaptador de cámara le pasa `t` y el "abajo" medido.
 */

export interface FrameInput {
  world: Landmark3D[];
  /** Instante del frame, en ms. */
  t: number;
  /** "Abajo" medido por el acelerómetro en ejes de `worldLandmarks`, o `null` sin lectura. */
  worldDown?: Vec3 | null;
}

export interface FrameDiagnostics {
  /** Inclinación del teléfono respecto a la vertical, en grados (null sin acelerómetro). */
  phoneTiltDeg: number | null;
  /** false si la inclinación superó el máximo corregible y el esqueleto no se niveló. */
  leveled: boolean;
  /** Corrección aplicada por la calibración de pie, en grados (null sin calibrar). */
  calibrationDeg: number | null;
  /** Avance de la calibración de pie, de 0 a 1 (lo muestra la pantalla de preparación). */
  calibrationProgress: number;
}

export interface FrameOutput {
  /** Landmarks tras suavizar, nivelar y calibrar: los que miden el contador y el visor 3D. */
  world: Landmark3D[];
  result: Tracker3DResult;
  diagnostics: FrameDiagnostics;
}

export class FramePipeline {
  private readonly smoother = new LandmarkSmoother();
  private readonly calibrator = new StandingCalibrator();
  private tracker: Tracker3D;
  /** Repeticiones contadas al empezar la serie en curso. */
  private repsAtSetStart = 0;

  constructor(def: ExerciseDefinition3D) {
    this.tracker = new Tracker3D(def);
  }

  get definition(): ExerciseDefinition3D {
    return this.tracker.def;
  }

  process(input: FrameInput): FrameOutput {
    const { world, diagnostics } = this.prepare(input);
    const result = this.tracker.update(world, input.t);
    return { world, result, diagnostics };
  }

  /**
   * Pasos 1–3 sin el contador: landmarks suavizados, nivelados y calibrados. Lo usan los
   * ejercicios que no cuentan ciclos (la plancha, isométrica) y el visor 3D.
   */
  prepare(input: FrameInput): { world: Landmark3D[]; diagnostics: FrameDiagnostics } {
    let world = this.smoother.smooth(input.world, input.t);

    let phoneTiltDeg: number | null = null;
    let leveled = true;
    if (input.worldDown) {
      const aligned = alignToGravityChecked(world, input.worldDown);
      world = aligned.world;
      phoneTiltDeg = aligned.tiltDeg;
      leveled = aligned.applied;
    }

    const def = this.tracker.def;
    const atRest = this.tracker.phase === 'rest';
    this.calibrator.setLearning(atRest && (def.calibrateDuringSet || this.tracker.repCount === this.repsAtSetStart));
    this.calibrator.update(world, input.t);
    world = this.calibrator.apply(world);

    return {
      world,
      diagnostics: {
        phoneTiltDeg, leveled,
        calibrationDeg: this.calibrator.correctionDeg,
        calibrationProgress: this.calibrator.progress,
      },
    };
  }

  /** Cambia de ejercicio: conteo nuevo, misma calibración (la persona y la cámara siguen). */
  setExercise(def: ExerciseDefinition3D): void {
    this.tracker = new Tracker3D(def);
    this.repsAtSetStart = 0;
    this.smoother.reset();
  }

  /** Nueva serie: reinicia la fatiga y permite recalibrar antes de la primera repetición. */
  startNewSet(): void {
    this.tracker.startNewSet();
    this.repsAtSetStart = this.tracker.repCount;
  }

  /** Cambio de cámara o de lugar: todo desde cero. */
  reset(): void {
    this.tracker.reset();
    this.repsAtSetStart = 0;
    this.smoother.reset();
    this.calibrator.reset();
  }
}
