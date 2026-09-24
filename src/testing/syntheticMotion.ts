/**
 * Utilidades para generar movimiento 3D sintético en los tests del motor (DEC-048).
 *
 * Portadas del banco de pruebas de fitnetv2 (`scripts/pruebas-motor.mjs`, commits
 * d456e95/821abcb/82e8783): ruido gaussiano con semilla fija, inclinación simulada de la
 * cámara y reproducción de las demos de `demoPoses` a cualquier fps, velocidad o recorrido.
 * Lo que NO cubren: la calidad de los landmarks reales. Eso solo se prueba en celular.
 */

import type { Landmark3D, Vec3 } from '../geometry/vectors3d';
import type { DemoDefinition, DemoPhase } from '../exercises/demoPoses';
import { sampleDemo } from '../exercises/demoPoses';

const DEG = Math.PI / 180;

/** Generador congruencial con semilla fija: los resultados son reproducibles entre corridas. */
export function seededGauss(seed = 42): () => number {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
}

/** Suma ruido gaussiano de desviación `sigma` (metros) a cada coordenada. */
export function jitter<T extends Landmark3D>(world: T[], sigma: number, gauss: () => number): T[] {
  if (!sigma) return world;
  return world.map(p => ({
    ...p,
    x: p.x + gauss() * sigma,
    y: p.y + gauss() * sigma,
    z: p.z + gauss() * sigma,
  }));
}

/**
 * Rotación que produce una cámara inclinada: primero `roll` sobre el eje de la vista, luego
 * `pitch` sobre el eje horizontal. Con pitch > 0 la cámara mira hacia abajo.
 */
export function rotateCamera(p: Vec3, pitchDeg: number, rollDeg: number): Vec3 {
  const r = rollDeg * DEG;
  const t = pitchDeg * DEG;
  const x = p.x * Math.cos(r) - p.y * Math.sin(r);
  const y = p.x * Math.sin(r) + p.y * Math.cos(r);
  const z = p.z;
  return { x, y: y * Math.cos(t) - z * Math.sin(t), z: y * Math.sin(t) + z * Math.cos(t) };
}

/** Aplica `rotateCamera` a todo el esqueleto, conservando la visibilidad. */
export function tiltPose<T extends Landmark3D>(world: T[], pitchDeg: number, rollDeg: number): T[] {
  return world.map(p => ({ ...p, ...rotateCamera(p, pitchDeg, rollDeg) }));
}

export interface PlayOptions {
  fps?: number;
  cycles?: number;
  /** Multiplica la duración de cada fase (0.4 = ritmo rápido, 0.12 = tirón). */
  speed?: number;
  /** Limita el recorrido: 0.3 = 30 % del movimiento. */
  pMax?: number;
  /**
   * Alarga la fase de esfuerzo en `slowdown × ciclo` para simular fatiga.
   * `effortPhase` es el índice de esa fase dentro de `def.phases`.
   */
  slowdown?: number;
  effortPhase?: number;
}

export interface MotionFrame {
  t: number;
  p: number;
  cycle: number;
  world: Landmark3D[];
}

/** Reproduce `cycles` repeticiones de una demo y devuelve un frame por cada paso de 1000/fps ms. */
export function playDemo(def: DemoDefinition, opts: PlayOptions = {}): MotionFrame[] {
  const { fps = 60, cycles = 5, speed = 1, pMax = 1, slowdown = 0, effortPhase = 1 } = opts;
  const dt = 1000 / fps;
  const frames: MotionFrame[] = [];
  let t = 0;

  for (let c = 0; c < cycles; c++) {
    const phases: DemoPhase[] = def.phases.map((ph, i) => ({
      ...ph,
      durationMs: ph.durationMs * speed * (i === effortPhase ? 1 + slowdown * c : 1),
      from: ph.from * pMax,
      to: ph.to * pMax,
    }));
    const cycleMs = phases.reduce((acc, ph) => acc + ph.durationMs, 0);
    const local: DemoDefinition = { ...def, phases };
    const n = Math.round(cycleMs / dt);
    for (let f = 0; f < n; f++) {
      const { p } = sampleDemo(local, f * dt);
      frames.push({ t, p, cycle: c, world: def.pose(p) });
      t += dt;
    }
  }
  return frames;
}
