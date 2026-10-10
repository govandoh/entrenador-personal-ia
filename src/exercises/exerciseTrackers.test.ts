import { describe, expect, it } from 'vitest';
import type { LandmarkFrame, RepEvent } from '../contracts/index.ts';
import type { Landmark3D } from '../geometry/vectors3d.ts';
import type { FixtureLandmark, LandmarkFixture } from '../testing/fixtureTypes.ts';
import { playDemo, type PlayOptions } from '../testing/syntheticMotion.ts';
import { FramePipeline } from '../analysis/framePipeline.ts';
import { DEMOS } from './demoPoses.ts';
import { CURL_3D, SQUAT_3D } from './definitions3d.ts';
import { SquatTracker } from './squat.ts';
import { BicepCurlTracker } from './bicepCurl.ts';
import { ShoulderPressTracker } from './shoulderPress.ts';
import {
  Engine3DTracker, PlankExerciseTracker, curl2D, press2D, squat2D, type EngineOutput, type EngineTracker,
} from './exerciseTrackers.ts';

/**
 * Los adaptadores del contrato (DEC-063) no cambian el comportamiento: frame a frame dan
 * lo mismo que el contador que envuelven, con sus señales traducidas a eventos.
 */

const FIXTURES = Object.entries(
  import.meta.glob('../../fixtures/landmarks/*.json', { eager: true, import: 'default' }),
)
  .filter(([path]) => !path.endsWith('index.json'))
  .map(([path, mod]) => [path.split('/').pop()!, mod as LandmarkFixture] as const);

// ─── Motor 2D: comparación con los fixtures golden del PR 1 ──────────────────

interface RawResult {
  phase: string;
  reps: number;
  feedbackLevel: string;
  feedbackMessage: string;
  atBottom?: boolean;
  atTop?: boolean;
  atPeak?: boolean;
  minAngleReached?: number;
  maxAngleReached?: number;
}

const CASES_2D = [
  { exercise: 'squat', adapter: squat2D, raw: () => new SquatTracker() },
  { exercise: 'curl', adapter: curl2D, raw: () => new BicepCurlTracker() },
  { exercise: 'press', adapter: press2D, raw: () => new ShoulderPressTracker() },
] as const;

/** Salida que debe dar el adaptador, construida a mano desde el contador original. */
function expected2D(raw: { update(l: FixtureLandmark[]): RawResult }, fixture: LandmarkFixture): EngineOutput[] {
  let prevReps = 0;
  return fixture.frames.map(f => {
    const r = raw.update(f.image);
    const events: RepEvent[] = [];
    if (r.atBottom || r.atTop || r.atPeak) {
      events.push({ kind: 'peak', t: f.t, extremeAngle: (r.atPeak ? r.maxAngleReached : r.minAngleReached)! });
    }
    if (r.reps > prevReps) events.push({ kind: 'complete', t: f.t });
    prevReps = r.reps;
    return {
      phase: r.phase, reps: r.reps, feedbackLevel: r.feedbackLevel as EngineOutput['feedbackLevel'],
      feedbackMessage: r.feedbackMessage, events, detail: { engine: '2d' },
    };
  });
}

const play2D = (tracker: EngineTracker, fixture: LandmarkFixture) =>
  fixture.frames.map(f => tracker.update({ t: f.t, image: f.image }));

describe.each(CASES_2D)('adaptador 2D: $exercise', ({ exercise, adapter, raw }) => {
  const fixtures = FIXTURES.filter(([, f]) => f.meta.exercise === exercise);

  it('tiene fixtures golden con que compararse', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it.each(fixtures)('%s: misma salida que el contador, con el pico y la rep como eventos', (_name, fixture) => {
    expect(play2D(adapter(), fixture)).toEqual(expected2D(raw(), fixture));
  });

  it('reset() vuelve a empezar de cero', () => {
    const [, fixture] = fixtures[0];
    const tracker = adapter();
    const first = play2D(tracker, fixture);
    tracker.reset();
    expect(play2D(tracker, fixture)).toEqual(first);
  });
});

// ─── Motor 3D ────────────────────────────────────────────────────────────────

const toFrame = (world: Landmark3D[], t: number): LandmarkFrame =>
  ({ t, image: [], world: world.map(p => ({ ...p, visibility: p.visibility ?? 1 })) });

function squatFrames(opts: PlayOptions = {}, fromMs = 0): LandmarkFrame[] {
  const frames = playDemo(DEMOS.sentadilla, { fps: 30, effortPhase: 3, ...opts });
  const last = frames.at(-1)?.t ?? 0;
  // Reposo al final para cerrar el último ciclo.
  for (let i = 1; i <= 30; i++) frames.push({ t: last + (i * 1000) / 30, p: 0, cycle: -1, world: DEMOS.sentadilla.pose(0) });
  return frames.map(f => toFrame(f.world, fromMs + f.t));
}

const count = (outs: EngineOutput[], kind: RepEvent['kind']) =>
  outs.reduce((n, o) => n + o.events.filter(e => e.kind === kind).length, 0);

describe('adaptador 3D', () => {
  it.each([
    { name: 'técnica correcta', opts: {} },
    { name: 'tirones (repeticiones descartadas)', opts: { speed: 0.12 } },
  ])('$name: traduce peak, repCounted y rejection del motor a eventos', ({ opts }) => {
    const frames = squatFrames(opts);
    const reference = new FramePipeline(SQUAT_3D);
    const tracker = new Engine3DTracker('squat', new FramePipeline(SQUAT_3D), SQUAT_3D);

    for (const frame of frames) {
      const ref = reference.process({ world: frame.world!, t: frame.t });
      const out = tracker.update(frame);
      const events: RepEvent[] = [];
      if (ref.result.peak) events.push({ kind: 'peak', t: frame.t, extremeAngle: ref.result.extremeDeg });
      if (ref.result.repCounted) events.push({ kind: 'complete', t: frame.t });
      if (ref.result.rejection) {
        events.push({ kind: 'rejected', t: frame.t, reason: ref.result.rejection, message: ref.result.rejectionMessage! });
      }
      expect(out.events).toEqual(events);
      expect(out.detail).toEqual({ engine: '3d', result: ref.result, world: ref.world });
      expect(out.reps).toBe(ref.result.reps);
    }
  });

  it('cuenta las 5 sentadillas y descarta los tirones', () => {
    const tracker = new Engine3DTracker('squat', new FramePipeline(SQUAT_3D), SQUAT_3D);
    expect(count(squatFrames().map(f => tracker.update(f)), 'complete')).toBe(5);
    const jerky = new Engine3DTracker('squat', new FramePipeline(SQUAT_3D), SQUAT_3D);
    const outs = squatFrames({ speed: 0.12 }).map(f => jerky.update(f));
    expect(count(outs, 'complete')).toBe(0);
    expect(count(outs, 'rejected')).toBeGreaterThan(0);
  });

  it('reps cuenta la serie en curso; el motor sigue acumulando, como antes del contrato', () => {
    const tracker = new Engine3DTracker('squat', new FramePipeline(SQUAT_3D), SQUAT_3D);
    const first = squatFrames({ cycles: 2 });
    for (const f of first) tracker.update(f);
    tracker.reset();
    const outs = squatFrames({ cycles: 2 }, first.at(-1)!.t + 1000).map(f => tracker.update(f));
    const last = outs.at(-1)!;
    expect(last.reps).toBe(2);
    expect(last.detail.engine === '3d' && last.detail.result.reps).toBe(4);
  });

  it('los ejercicios comparten el pipeline: reset() cambia la definición y conserva la calibración', () => {
    const pipeline = new FramePipeline(SQUAT_3D);
    const curl = new Engine3DTracker('curl', pipeline, CURL_3D);
    const standing = toFrame(DEMOS.sentadilla.pose(0), 0);
    let progress = 0;
    for (let t = 0; t < 4000; t += 33) {
      progress = pipeline.prepare({ world: standing.world!, t }).diagnostics.calibrationProgress;
    }
    expect(progress).toBeGreaterThan(0);

    curl.reset();
    expect(pipeline.definition).toBe(CURL_3D);
    expect(pipeline.prepare({ world: standing.world!, t: 4000 }).diagnostics.calibrationProgress).toBeGreaterThanOrEqual(progress);
  });

  it('sin landmarks 3D no mide nada ni toca el pipeline', () => {
    const tracker = new Engine3DTracker('squat', new FramePipeline(SQUAT_3D), SQUAT_3D);
    const out = tracker.update({ t: 0, image: [] });
    expect(out.detail).toEqual({ engine: 'none' });
    expect(out.events).toEqual([]);
    expect(out.feedbackMessage).toBe(SQUAT_3D.notVisibleMessage);
  });
});

// ─── Plancha ─────────────────────────────────────────────────────────────────

describe('adaptador de la plancha', () => {
  it('sostiene el tiempo sin eventos y reset() lo vuelve a cero', () => {
    const pipeline = new FramePipeline(CURL_3D);
    const plank = new PlankExerciseTracker(pipeline, SQUAT_3D);
    plank.reset();
    expect(pipeline.definition).toBe(SQUAT_3D);

    const pose = DEMOS.flexiones.pose(0);
    let out = plank.update(toFrame(pose, 0));
    for (let t = 33; t <= 5000; t += 33) {
      out = plank.update(toFrame(pose, t));
      expect(out.events).toEqual([]);
    }
    expect(out.detail.engine === 'hold' && out.detail.result.heldSeconds).toBeGreaterThanOrEqual(4);

    plank.reset();
    const again = plank.update(toFrame(pose, 6000));
    expect(again.detail.engine === 'hold' && again.detail.result.heldSeconds).toBe(0);
  });
});
