import { describe, expect, it } from 'vitest';
import type { LandmarkFixture } from '../testing/fixtureTypes.ts';
import { ReplayPoseSource } from './replayPoseSource';
import type { LandmarkFrame } from './types';

const point = (v: number) => ({ x: v, y: v, z: 0, visibility: 1 });

function fixture(ts: number[], view: LandmarkFixture['meta']['view'] = 'side', withWorld = false): LandmarkFixture {
  return {
    meta: {
      schemaVersion: 1, exercise: 'squat', view, quality: 'good', source: 'synthetic',
      fps: 30, recordedAt: '2026-10-07T00:00:00.000Z',
    },
    frames: ts.map((t, i) => ({
      t,
      image: Array.from({ length: 33 }, () => point(i / 10)),
      ...(withWorld ? { world: Array.from({ length: 33 }, () => point(-i)) } : {}),
    })),
  };
}

function collect(src: ReplayPoseSource): LandmarkFrame[] {
  const out: LandmarkFrame[] = [];
  src.onFrame((f) => out.push(f));
  return out;
}

describe('ReplayPoseSource (modo inmediato)', () => {
  it('emite cada frame del fixture con su t, seq correlativo, image y world', async () => {
    const fx = fixture([0, 33, 67, 100], 'side', true);
    const src = new ReplayPoseSource(fx);
    const frames = collect(src);
    let ended = 0;
    src.onEnd(() => ended++);

    await src.start();

    expect(frames).toHaveLength(4);
    expect(frames.map((f) => f.t)).toEqual([0, 33, 67, 100]);
    expect(frames.map((f) => f.seq)).toEqual([0, 1, 2, 3]);
    expect(frames[2].image).toBe(fx.frames[2].image);
    expect(frames[2].world).toBe(fx.frames[2].world);
    expect(ended).toBe(1);
  });

  it('traduce la vista del fixture; 45 grados queda como unknown', async () => {
    for (const [view, expected] of [['side', 'side'], ['front', 'front'], ['45', 'unknown']] as const) {
      const src = new ReplayPoseSource(fixture([0], view));
      const frames = collect(src);
      await src.start();
      expect(frames[0].view).toBe(expected);
    }
  });

  it('deja world sin definir cuando el fixture no lo trae (sintéticos)', async () => {
    const src = new ReplayPoseSource(fixture([0, 10]));
    const frames = collect(src);
    await src.start();
    expect(frames[0].world).toBeUndefined();
  });

  it('stop() desde un listener corta la reproducción y no dispara onEnd', async () => {
    const src = new ReplayPoseSource(fixture([0, 10, 20, 30, 40]));
    const frames: LandmarkFrame[] = [];
    src.onFrame((f) => { frames.push(f); if (f.seq === 1) src.stop(); });
    let ended = false;
    src.onEnd(() => { ended = true; });
    await src.start();
    expect(frames).toHaveLength(2);
    expect(ended).toBe(false);
  });

  it('la función devuelta por onFrame desuscribe y un nuevo start() reinicia seq', async () => {
    const src = new ReplayPoseSource(fixture([0, 10]));
    const a: number[] = [];
    const off = src.onFrame((f) => a.push(f.seq));
    await src.start();
    off();
    const b = collect(src);
    await src.start();
    expect(a).toEqual([0, 1]);
    expect(b.map((f) => f.seq)).toEqual([0, 1]);
  });
});

describe('ReplayPoseSource (modo realtime)', () => {
  /** Temporizador manual: guarda los callbacks con su retraso y los dispara a mano. */
  function manualTimers() {
    const queue: { cb: () => void; ms: number; id: number }[] = [];
    let nextId = 1;
    return {
      queue,
      setTimer: (cb: () => void, ms: number) => { const id = nextId++; queue.push({ cb, ms, id }); return id; },
      clearTimer: (id: unknown) => { const i = queue.findIndex((q) => q.id === id); if (i >= 0) queue.splice(i, 1); },
      fire: () => queue.shift()!.cb(),
    };
  }

  it('espera entre frames la diferencia de t dividida por la velocidad', async () => {
    const timers = manualTimers();
    const src = new ReplayPoseSource(fixture([0, 40, 100]), { realtime: true, speed: 2, ...timers });
    const frames = collect(src);
    let ended = false;
    src.onEnd(() => { ended = true; });

    await src.start();
    expect(frames).toHaveLength(0);
    expect(timers.queue[0].ms).toBe(0);

    timers.fire();
    expect(frames).toHaveLength(1);
    expect(timers.queue[0].ms).toBe(20);
    timers.fire();
    expect(timers.queue[0].ms).toBe(30);
    timers.fire();

    expect(frames.map((f) => f.seq)).toEqual([0, 1, 2]);
    expect(timers.queue).toHaveLength(0);
    expect(ended).toBe(true);
  });

  it('stop() cancela el temporizador pendiente', async () => {
    const timers = manualTimers();
    const src = new ReplayPoseSource(fixture([0, 40]), { realtime: true, ...timers });
    const frames = collect(src);
    await src.start();
    timers.fire();
    src.stop();
    expect(timers.queue).toHaveLength(0);
    expect(frames).toHaveLength(1);
  });

  it('un fixture vacío termina sin programar temporizadores', async () => {
    const timers = manualTimers();
    const src = new ReplayPoseSource(fixture([]), { realtime: true, ...timers });
    let ended = false;
    src.onEnd(() => { ended = true; });
    await src.start();
    expect(timers.queue).toHaveLength(0);
    expect(ended).toBe(true);
  });
});
