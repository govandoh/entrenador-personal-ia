/**
 * Pipeline por replay (PR 3, issue #12): los trackers alimentados por `ReplayPoseSource`
 * dan exactamente el mismo resultado que el `replay()` de los golden. Prueba que la fuente
 * es intercambiable con la cámara sin alterar el conteo.
 *
 * Vive en `src/testing/` y no en `src/pose/` porque cruza dos workstreams (pose → análisis)
 * y la dirección de dependencias prohíbe que `pose` importe trackers.
 */
import { describe, expect, it } from 'vitest';
import { ReplayPoseSource } from '../pose/replayPoseSource';
import { SquatTracker } from '../exercises/squat';
import { BicepCurlTracker } from '../exercises/bicepCurl';
import { ShoulderPressTracker } from '../exercises/shoulderPress';
import { replay, type ReplayableTracker, type TrackerResultLike } from './replay.ts';
import type { LandmarkFixture } from './fixtureTypes.ts';

const MODULES = import.meta.glob('../../fixtures/landmarks/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

const fixtures = Object.entries(MODULES)
  .filter(([path]) => !path.endsWith('/index.json'))
  .map(([path, mod]) => [path.split('/').pop()!, mod as LandmarkFixture] as const);

function newTracker(fx: LandmarkFixture): ReplayableTracker<TrackerResultLike> {
  switch (fx.meta.exercise) {
    case 'squat': return new SquatTracker();
    case 'curl':  return new BicepCurlTracker();
    case 'press': return new ShoulderPressTracker();
    default: throw new Error(`Sin tracker 2D para ${fx.meta.exercise}`);
  }
}

describe('ReplayPoseSource → trackers', () => {
  it('hay fixtures que reproducir', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  for (const [name, fx] of fixtures) {
    it(`${name}: mismas reps y fases que el replay golden`, async () => {
      const expected = replay(fx, newTracker(fx));

      const tracker = newTracker(fx);
      const src = new ReplayPoseSource(fx);
      let frames = 0;
      let reps = 0;
      const phases: string[] = [];
      src.onFrame((frame) => {
        const r = tracker.update(frame.image);
        frames++;
        reps = r.reps;
        if (phases.at(-1) !== r.phase) phases.push(r.phase);
      });
      await src.start();

      expect(frames).toBe(expected.frames);
      expect(reps).toBe(expected.reps);
      expect(phases.slice(1)).toEqual(expected.transitions.map((tr) => tr.to));
    });
  }
});
