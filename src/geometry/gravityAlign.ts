import type { Landmark3D, Vec3 } from './vectors3d.ts';

/**
 * Nivelación del esqueleto con la gravedad real (ver DEC-050).
 *
 * Problema: los `worldLandmarks` de MediaPipe están alineados con la CÁMARA, no con el
 * suelo. Si el celular está inclinado 20°, el esqueleto completo aparece inclinado 20° y
 * todas las medidas contra la vertical salen corridas (inclinación del tronco, arqueo en
 * press, codo que se despega en curl). Los ángulos articulares no cambian con la
 * rotación; lo que se corrige son las medidas contra la vertical.
 *
 * Este módulo es la parte pura: estimar "abajo" a partir de lecturas del acelerómetro
 * (`GravityEstimator`), pasarlo a ejes de cámara y rotar los landmarks. El listener de
 * `devicemotion` y el permiso de iOS son del adaptador de captura (workstream A).
 *
 * Portado de fitnetv2 (`src/pose/deviceGravity.ts`, commit 821abcb). Cambios: el
 * suavizado usa el `t` que recibe en lugar de `performance.now()`, y la rotación informa
 * si se aplicó para que la UI pueda pedir que se acomode el teléfono.
 */

const DEG = Math.PI / 180;

/** Constante de tiempo del suavizado, en ms: absorbe el pulso de la mano sin retrasar un reacomodo. */
const SMOOTHING_MS = 400;
/** Módulo aceptado de la lectura, en m/s². Fuera de él el teléfono se mueve y la lectura no es solo gravedad. */
const MIN_G = 6.5;
const MAX_G = 13;
/** Fracción mínima de la gravedad sobre el eje vertical de la pantalla. Debajo, el celular está casi horizontal. */
const MIN_UPRIGHT = 0.35;
/** Inclinación máxima que se corrige, en grados. Más allá, algo no cuadra y es mejor no tocar nada. */
export const MAX_CORRECTION_DEG = 60;

/** Lectura cruda de `DeviceMotionEvent.accelerationIncludingGravity`, en ejes del teléfono. */
export interface AccelerationSample {
  x: number;
  y: number;
  z: number;
}

/**
 * Estima la dirección "abajo" en ejes de pantalla a partir de lecturas del acelerómetro.
 * Ejes de pantalla: x a la derecha, y hacia arriba, z saliendo de la pantalla.
 */
export class GravityEstimator {
  private screenDown: Vec3 | null = null;
  private lastTimeMs = 0;

  /**
   * Incorpora una lectura. `screenAngleDeg` es `screen.orientation.angle`; `timeMs` es el
   * instante de la lectura. Devuelve false si la lectura se descartó.
   */
  addSample(a: AccelerationSample, screenAngleDeg: number, timeMs: number): boolean {
    // Los ejes del sensor son los del teléfono; la imagen sigue a la pantalla.
    const angle = screenAngleDeg * DEG;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const sx = a.x * cos - a.y * sin;
    const sy = a.x * sin + a.y * cos;
    const sz = a.z;

    const mag = Math.hypot(sx, sy, sz);
    if (mag < MIN_G || mag > MAX_G) return false;
    if (Math.abs(sy) / mag < MIN_UPRIGHT) return false;

    // Android reporta la reacción del apoyo (apunta arriba) e iOS la gravedad (apunta
    // abajo). Con el celular en vertical, "abajo" siempre apunta al borde inferior de la
    // pantalla, así que se elige el signo que cumple eso sin detectar el navegador.
    const sign = sy > 0 ? -1 : 1;
    const sample: Vec3 = { x: (sign * sx) / mag, y: (sign * sy) / mag, z: (sign * sz) / mag };

    if (!this.screenDown) {
      this.screenDown = sample;
    } else {
      const dt = Math.max(0, timeMs - this.lastTimeMs);
      const k = 1 - Math.exp(-dt / SMOOTHING_MS);
      const d = this.screenDown;
      this.screenDown = {
        x: d.x + (sample.x - d.x) * k,
        y: d.y + (sample.y - d.y) * k,
        z: d.z + (sample.z - d.z) * k,
      };
    }
    this.lastTimeMs = timeMs;
    return true;
  }

  get hasReading(): boolean {
    return this.screenDown !== null;
  }

  /** "Abajo" en ejes de `worldLandmarks`, o `null` sin lectura confiable. */
  worldDown(facing: CameraFacing): Vec3 | null {
    return this.screenDown ? screenDownToWorld(this.screenDown, facing) : null;
  }

  reset(): void {
    this.screenDown = null;
    this.lastTimeMs = 0;
  }
}

export type CameraFacing = 'environment' | 'user';

/**
 * Pasa "abajo" de ejes de pantalla a ejes de `worldLandmarks` (x a la derecha de la
 * imagen, y hacia abajo, z alejándose de la cámara).
 *
 * Cámara trasera: alejarse de ella es ir contra z de la pantalla. Cámara frontal:
 * alejarse es ir a favor de z, y la imagen sin espejar invierte la derecha.
 */
export function screenDownToWorld(down: Vec3, facing: CameraFacing): Vec3 {
  return facing === 'environment'
    ? { x: down.x, y: -down.y, z: -down.z }
    : { x: -down.x, y: -down.y, z: down.z };
}

/** Grados entre `worldDown` y el eje +Y; lo que la nivelación tendría que corregir. */
export function gravityTiltDeg(worldDown: Vec3): number {
  const len = Math.hypot(worldDown.x, worldDown.y, worldDown.z);
  if (len === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, worldDown.y / len))) / DEG;
}

export interface AlignResult<T extends Landmark3D> {
  world: T[];
  /** Inclinación detectada, en grados. */
  tiltDeg: number;
  /** false si la inclinación superó `MAX_CORRECTION_DEG` y no se corrigió. */
  applied: boolean;
}

/**
 * Gira los landmarks para que `worldDown` pase a ser +Y e informa si lo hizo.
 *
 * Usa la rotación mínima entre ambos vectores, alrededor del eje perpendicular a los dos
 * (fórmula de Rodrigues): no introduce giro alrededor de la vertical, así que hacia dónde
 * mira el usuario se conserva. El origen (centro de la cadera) queda fijo.
 */
export function alignToGravityChecked<T extends Landmark3D>(world: T[], worldDown: Vec3): AlignResult<T> {
  const len = Math.hypot(worldDown.x, worldDown.y, worldDown.z);
  if (len === 0) return { world, tiltDeg: 0, applied: false };
  const d = { x: worldDown.x / len, y: worldDown.y / len, z: worldDown.z / len };

  // Eje de giro = d × (0,1,0); coseno = d · (0,1,0).
  const kx = -d.z;
  const kz = d.x;
  const sinA = Math.hypot(kx, kz);
  const cosA = d.y;
  const tiltDeg = Math.atan2(sinA, cosA) / DEG;

  if (sinA < 1e-4 && cosA > 0) return { world, tiltDeg: 0, applied: true }; // ya alineado
  if (tiltDeg > MAX_CORRECTION_DEG) return { world, tiltDeg, applied: false };

  const ux = kx / sinA;
  const uz = kz / sinA;

  const rotated = world.map(p => {
    // v' = v·cos + (k × v)·sin + k·(k·v)·(1 − cos), con k = (ux, 0, uz)
    const kDotV = ux * p.x + uz * p.z;
    const crossX = -uz * p.y;
    const crossY = uz * p.x - ux * p.z;
    const crossZ = ux * p.y;
    return {
      ...p,
      x: p.x * cosA + crossX * sinA + ux * kDotV * (1 - cosA),
      y: p.y * cosA + crossY * sinA,
      z: p.z * cosA + crossZ * sinA + uz * kDotV * (1 - cosA),
    };
  });
  return { world: rotated, tiltDeg, applied: true };
}

/** Variante que devuelve solo los landmarks (sin corregir si la inclinación es excesiva). */
export function alignToGravity<T extends Landmark3D>(world: T[], worldDown: Vec3): T[] {
  return alignToGravityChecked(world, worldDown).world;
}
