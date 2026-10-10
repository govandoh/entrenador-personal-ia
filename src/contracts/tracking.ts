import type { LandmarkFrame } from './pose.ts';

/**
 * Contrato de los contadores de ejercicio (PR 2 de ARCHITECTURE.md, DEC-063).
 *
 * La UI recorre un `Record<ExerciseId, ExerciseTracker>` y reacciona a `events`, sin
 * conocer qué motor (2D o 3D) ni qué señal (`atBottom`, `atTop`, `atPeak`) usa cada uno.
 */

/** Ejercicios con contador por cámara. Añadir uno es un cambio de contrato. */
export type ExerciseId = 'squat' | 'curl' | 'press' | 'pushup' | 'lunge' | 'bridge' | 'plank';

export type FeedbackLevel = 'idle' | 'good' | 'warning' | 'bad';

export type RepEvent =
  /** Se confirmó el pico o fondo del ciclo; `extremeAngle` es el extremo alcanzado, en grados. */
  | { kind: 'peak'; t: number; extremeAngle: number }
  /** Se contó una repetición válida. */
  | { kind: 'complete'; t: number }
  /** Se descartó un ciclo completo; `reason` es el código y `message` lo que se le dice a la persona. */
  | { kind: 'rejected'; t: number; reason: string; message: string };

export interface TrackerOutput {
  /** Fase del ciclo, propia de cada contador (informativa). */
  phase: string;
  /** Repeticiones válidas desde el último `reset()`. */
  reps: number;
  feedbackLevel: FeedbackLevel;
  feedbackMessage: string;
  /** Eventos ocurridos en este frame, en orden (normalmente ninguno). */
  events: RepEvent[];
}

export interface ExerciseTracker {
  readonly exerciseId: ExerciseId;
  update(frame: LandmarkFrame): TrackerOutput;
  /** Serie nueva de este ejercicio: `reps` vuelve a 0. */
  reset(): void;
}
