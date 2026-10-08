import type { LandmarkFixture } from '../testing/fixtureTypes';
import type { FrameView, LandmarkFrame, PoseSource } from './types';

export interface ReplayPoseSourceOptions {
  /**
   * `false` (por defecto): `start()` emite todos los frames seguidos y resuelve al final;
   * es lo que usan los tests. `true`: respeta los `t` del fixture con temporizadores, para
   * reproducir una grabación en la app o en Playwright sin cámara.
   */
  realtime?: boolean;
  /** Multiplicador de velocidad en modo `realtime` (2 = doble de rápido). */
  speed?: number;
  /** Temporizadores; se sustituyen en los tests. */
  setTimer?: (cb: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

const FIXTURE_VIEW: Record<LandmarkFixture['meta']['view'], FrameView> = {
  side: 'side',
  front: 'front',
  '45': 'unknown',
};

/**
 * Reproduce un fixture de `fixtures/landmarks/` como `PoseSource` (PR 3, issue #12).
 *
 * Permite probar el pipeline completo sin cámara ni MediaPipe: quien consume frames no
 * distingue entre esta fuente y `CameraPoseSource`. `t` es el del fixture (ms desde el
 * primer frame) e incluye `world` cuando la grabación lo trae.
 */
export class ReplayPoseSource implements PoseSource {
  private readonly fixture: LandmarkFixture;
  private readonly view: FrameView;
  private readonly realtime: boolean;
  private readonly speed: number;
  private readonly setTimer: (cb: () => void, ms: number) => unknown;
  private readonly clearTimer: (id: unknown) => void;
  private readonly listeners = new Set<(f: LandmarkFrame) => void>();
  private readonly endListeners = new Set<() => void>();
  private timer: unknown = null;
  private running = false;
  private next = 0;

  constructor(fixture: LandmarkFixture, opts: ReplayPoseSourceOptions = {}) {
    this.fixture = fixture;
    this.view = FIXTURE_VIEW[fixture.meta.view];
    this.realtime = opts.realtime ?? false;
    this.speed = opts.speed && opts.speed > 0 ? opts.speed : 1;
    this.setTimer = opts.setTimer ?? ((cb, ms) => setTimeout(cb, ms));
    this.clearTimer = opts.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  }

  onFrame(cb: (f: LandmarkFrame) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Se llama al emitir el último frame (no si se detuvo antes). */
  onEnd(cb: () => void): () => void {
    this.endListeners.add(cb);
    return () => this.endListeners.delete(cb);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.next = 0;
    if (!this.realtime || this.fixture.frames.length === 0) {
      // Un listener puede llamar a stop() en medio de la reproducción.
      while (this.running && this.next < this.fixture.frames.length) this.emitNext();
      this.finishIfDone();
      return;
    }
    this.scheduleNext(0);
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }

  private emitNext(): void {
    const i = this.next++;
    const src = this.fixture.frames[i];
    const frame: LandmarkFrame = { t: src.t, seq: i, image: src.image, world: src.world, view: this.view };
    for (const cb of this.listeners) cb(frame);
  }

  private scheduleNext(delayMs: number): void {
    this.timer = this.setTimer(() => {
      this.timer = null;
      if (!this.running) return;
      const prevT = this.fixture.frames[this.next].t;
      this.emitNext();
      if (this.next < this.fixture.frames.length) {
        this.scheduleNext((this.fixture.frames[this.next].t - prevT) / this.speed);
      } else {
        this.finishIfDone();
      }
    }, delayMs);
  }

  private finishIfDone(): void {
    if (!this.running || this.next < this.fixture.frames.length) return;
    this.running = false;
    for (const cb of this.endListeners) cb();
  }
}
