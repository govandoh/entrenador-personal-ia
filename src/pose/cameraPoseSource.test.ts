import { describe, expect, it, vi } from 'vitest';
import { CameraPoseSource, type CameraPoseSourceDeps } from './cameraPoseSource';
import type { PoseDetection } from './poseDetector';
import type { CanvasSkeletonRenderer } from './skeletonRenderer';
import type { LandmarkFrame } from './types';

// El módulo real importa MediaPipe; aquí solo se prueba el bucle con dependencias falsas.
vi.mock('./poseDetector', () => ({ detect: vi.fn(), initPoseDetector: vi.fn() }));
vi.mock('./skeletonRenderer', () => ({}));

const pts = (v: number) => Array.from({ length: 33 }, () => ({ x: v, y: v, z: 0, visibility: 1 }));

function harness(detections: (PoseDetection | null)[]) {
  const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;
  const stream = { id: 'stream' } as unknown as MediaStream;
  let pending: (() => void) | null = null;
  let clock = 1000;
  const deps: CameraPoseSourceDeps = {
    init: vi.fn(async () => {}),
    startCamera: vi.fn(async () => stream),
    stopCamera: vi.fn(),
    detect: vi.fn(() => detections.shift() ?? null),
    now: () => (clock += 33),
    requestFrame: vi.fn((cb) => { pending = cb; return 7; }),
    cancelFrame: vi.fn(() => { pending = null; }),
  };
  const renderer = { resize: vi.fn(), draw: vi.fn(), clear: vi.fn() };
  const src = new CameraPoseSource({
    video, deps, renderer: renderer as unknown as CanvasSkeletonRenderer,
  });
  const frames: LandmarkFrame[] = [];
  src.onFrame((f) => frames.push(f));
  const tick = () => { const cb = pending; pending = null; cb?.(); };
  return { src, deps, renderer, frames, stream, tick, hasPending: () => pending !== null };
}

describe('CameraPoseSource', () => {
  it('emite image y world con t en ms y seq correlativo, y dibuja cada frame', async () => {
    const h = harness([
      { image: pts(0.1), world: pts(1) },
      { image: pts(0.2), world: null },
    ]);
    await h.src.start();
    h.tick();
    h.tick();

    expect(h.frames.map((f) => f.seq)).toEqual([0, 1]);
    expect(h.frames.map((f) => f.t)).toEqual([1033, 1066]);
    expect(h.frames[0].world).toEqual(pts(1));
    expect(h.frames[1].world).toBeUndefined();
    expect(h.renderer.resize).toHaveBeenCalledWith(640, 480);
    expect(h.renderer.draw).toHaveBeenCalledTimes(2);
  });

  it('sin persona limpia el canvas y no emite; sin imagen lista no toca el canvas', async () => {
    const h = harness([{ image: null, world: null }, null]);
    await h.src.start();
    h.tick();
    h.tick();
    expect(h.frames).toHaveLength(0);
    expect(h.renderer.clear).toHaveBeenCalledTimes(1);
    expect(h.renderer.resize).toHaveBeenCalledTimes(1);
    expect(h.hasPending()).toBe(true);
  });

  it('stop() cancela el bucle y apaga la cámara', async () => {
    const h = harness([{ image: pts(0.1), world: null }]);
    await h.src.start();
    h.src.stop();
    expect(h.deps.cancelFrame).toHaveBeenCalledWith(7);
    expect(h.deps.stopCamera).toHaveBeenCalledWith(h.stream);
    h.tick();
    expect(h.frames).toHaveLength(0);
  });

  it('si stop() llega mientras se abre la cámara, la suelta y no arranca el bucle', async () => {
    const h = harness([]);
    let resolveCam: (s: MediaStream) => void = () => {};
    h.deps.startCamera = vi.fn(() => new Promise<MediaStream>((r) => { resolveCam = r; }));
    const started = h.src.start();
    await Promise.resolve();
    h.src.stop();
    resolveCam(h.stream);
    await started;
    expect(h.deps.stopCamera).toHaveBeenCalledWith(h.stream);
    expect(h.deps.requestFrame).not.toHaveBeenCalled();
  });
});
