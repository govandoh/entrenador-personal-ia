import { startCamera, stopCamera } from './camera';
import { detect, initPoseDetector, type PoseDetection } from './poseDetector';
import type { CanvasSkeletonRenderer } from './skeletonRenderer';
import type { LandmarkFrame, PoseSource } from './types';

type Facing = 'environment' | 'user';

/** Dependencias del navegador; se sustituyen en los tests. */
export interface CameraPoseSourceDeps {
  init: () => Promise<void>;
  startCamera: (video: HTMLVideoElement, facing: Facing) => Promise<MediaStream>;
  stopCamera: (stream: MediaStream) => void;
  detect: (video: HTMLVideoElement, t: number) => PoseDetection | null;
  now: () => number;
  requestFrame: (cb: () => void) => number;
  cancelFrame: (id: number) => void;
}

const browserDeps = (): CameraPoseSourceDeps => ({
  init: initPoseDetector,
  startCamera,
  stopCamera,
  detect,
  now: () => performance.now(),
  requestFrame: (cb) => requestAnimationFrame(cb),
  cancelFrame: (id) => cancelAnimationFrame(id),
});

export interface CameraPoseSourceOptions {
  video: HTMLVideoElement;
  facingMode?: Facing;
  /** Si se pasa, dibuja cada frame (y limpia el canvas cuando no hay persona). */
  renderer?: CanvasSkeletonRenderer;
  deps?: Partial<CameraPoseSourceDeps>;
}

/**
 * Cámara + MediaPipe como `PoseSource` (PR 3, issue #12).
 *
 * Un bucle de `requestAnimationFrame` detecta en cada frame, emite un `LandmarkFrame` con
 * `image` y `world` cuando hay persona y, si tiene renderer, dibuja. `t` es
 * `performance.now()` en ms (nunca un contador de frames). La espera de 450 ms tras
 * apagar una cámara (DEC-021) sigue siendo responsabilidad de quien llama a `start`.
 */
export class CameraPoseSource implements PoseSource {
  private readonly video: HTMLVideoElement;
  private readonly facing: Facing;
  private readonly renderer?: CanvasSkeletonRenderer;
  private readonly deps: CameraPoseSourceDeps;
  private readonly listeners = new Set<(f: LandmarkFrame) => void>();
  private stream: MediaStream | null = null;
  private rafId: number | null = null;
  private running = false;
  private seq = 0;

  constructor(opts: CameraPoseSourceOptions) {
    this.video = opts.video;
    this.facing = opts.facingMode ?? 'environment';
    this.renderer = opts.renderer;
    this.deps = { ...browserDeps(), ...opts.deps };
  }

  onFrame(cb: (f: LandmarkFrame) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.seq = 0;
    await this.deps.init();
    if (!this.running) return;
    const stream = await this.deps.startCamera(this.video, this.facing);
    // `stop()` llegó mientras se abría la cámara: soltarla en vez de dejarla encendida.
    if (!this.running) {
      this.deps.stopCamera(stream);
      return;
    }
    this.stream = stream;
    this.rafId = this.deps.requestFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) this.deps.cancelFrame(this.rafId);
    this.rafId = null;
    if (this.stream) this.deps.stopCamera(this.stream);
    this.stream = null;
  }

  private tick = (): void => {
    if (!this.running) return;
    const t = this.deps.now();
    const detection = this.deps.detect(this.video, t);

    if (detection) {
      if (this.renderer) this.renderer.resize(this.video.videoWidth, this.video.videoHeight);
      if (detection.image) {
        const frame: LandmarkFrame = {
          t,
          seq: this.seq++,
          image: detection.image,
          world: detection.world ?? undefined,
          view: 'unknown',
        };
        this.renderer?.draw(frame);
        for (const cb of this.listeners) cb(frame);
      } else {
        this.renderer?.clear();
      }
    }

    if (this.running) this.rafId = this.deps.requestFrame(this.tick);
  };
}
