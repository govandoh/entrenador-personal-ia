/**
 * Reproduce un fixture de landmarks contra un tracker y resume su comportamiento.
 *
 * El resumen es lo que congelan los snapshots golden: conteo final de reps, cada cambio
 * de fase con el frame en que ocurre, los frames donde el tracker señaló el pico del
 * movimiento (`atBottom`/`atTop`/`atPeak` según el ejercicio) y cuántos frames pasó en
 * cada nivel de feedback.
 *
 * Sin dependencias de Node ni del DOM: los tres trackers son clases puras.
 */

import type { FixtureLandmark, LandmarkFixture } from './fixtureTypes.ts';

/** Campos comunes a `SquatResult`, `BicepCurlResult` y `ShoulderPressResult`. */
export interface TrackerResultLike {
  phase:         string;
  reps:          number;
  feedbackLevel: string;
  /** Sentadilla. */
  atBottom?: boolean;
  /** Curl. */
  atTop?: boolean;
  /** Press. */
  atPeak?: boolean;
}

export interface ReplayableTracker<R extends TrackerResultLike> {
  update(landmarks: FixtureLandmark[]): R;
}

export interface PhaseTransition {
  frame: number;
  from:  string;
  to:    string;
}

export interface ReplaySummary {
  frames: number;
  /** Conteo de reps al final de la reproducción. */
  reps: number;
  transitions: PhaseTransition[];
  /** Índices de frame donde `atBottom`/`atTop`/`atPeak` fue true. */
  peakFrames: number[];
  /** Frames en cada nivel de feedback ('idle' | 'good' | 'warning' | 'bad'). */
  feedbackLevels: Record<string, number>;
  /** Índices de frame donde el contador de reps se incrementó. */
  repFrames: number[];
}

/** true si el tracker señaló el evento de pico del ejercicio en este frame. */
function firedPeak(r: TrackerResultLike): boolean {
  return r.atBottom === true || r.atTop === true || r.atPeak === true;
}

export function replay<R extends TrackerResultLike>(
  fixture: LandmarkFixture,
  tracker: ReplayableTracker<R>,
): ReplaySummary {
  const transitions: PhaseTransition[] = [];
  const peakFrames: number[] = [];
  const repFrames: number[]  = [];
  const feedbackLevels: Record<string, number> = {};

  let prevPhase = '';
  let prevReps  = 0;
  let reps      = 0;

  fixture.frames.forEach((frame, i) => {
    const r = tracker.update(frame.image);

    if (i === 0) prevPhase = r.phase;
    else if (r.phase !== prevPhase) {
      transitions.push({ frame: i, from: prevPhase, to: r.phase });
      prevPhase = r.phase;
    }

    if (firedPeak(r)) peakFrames.push(i);
    if (r.reps > prevReps) repFrames.push(i);

    feedbackLevels[r.feedbackLevel] = (feedbackLevels[r.feedbackLevel] ?? 0) + 1;
    prevReps = r.reps;
    reps     = r.reps;
  });

  return { frames: fixture.frames.length, reps, transitions, peakFrames, feedbackLevels, repFrames };
}
