import type { AssistantId } from '../../domain/catalog';
import type { Vec3 } from '../../geometry/vectors3d';
import { gravityTiltDeg } from '../../geometry/gravityAlign';
import { LM } from '../../geometry/vectors3d';

/**
 * Comprobaciones de la pantalla de preparación (DESIGN.md §5, nivelador): celular nivelado,
 * cuerpo dentro del cuadro y, en el motor 3D, calibración de pie. Funciones puras para
 * poder probarlas sin cámara; el componente solo las llama.
 */

/**
 * Inclinación máxima para dar el celular por nivelado, en grados. La nivelación corrige
 * hasta 60° (DEC-050), pero con más de ~20° la persona queda recortada o en perspectiva:
 * se pide acomodarlo antes de empezar.
 */
export const LEVEL_OK_DEG = 20;
/** Tiempo que las tres comprobaciones deben seguir en verde para empezar solas, en ms. */
export const AUTO_START_MS = 1200;
const MIN_VISIBILITY = 0.5;

/** Landmarks que tienen que verse para cada ejercicio. */
const UPPER = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_WRIST, LM.LEFT_HIP, LM.RIGHT_HIP];
const FULL = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE];

export function requiredLandmarks(ex: AssistantId): readonly number[] {
  return ex === 'curl' || ex === 'press' ? UPPER : FULL;
}

interface Visible { visibility?: number }

/**
 * Cuerpo dentro del cuadro. En vista lateral un lado se ve peor: basta con que se vea
 * al menos un lado completo de cada par izquierdo/derecho.
 */
export function bodyInFrame(landmarks: readonly Visible[] | null | undefined, ex: AssistantId): boolean {
  if (!landmarks || landmarks.length < 33) return false;
  const req = requiredLandmarks(ex);
  for (let i = 0; i < req.length; i += 2) {
    const a = landmarks[req[i]]?.visibility ?? 0;
    const b = landmarks[req[i + 1]]?.visibility ?? 0;
    if (Math.max(a, b) < MIN_VISIBILITY) return false;
  }
  return true;
}

/** Inclinación del celular en grados, o `null` sin acelerómetro. */
export function phoneTilt(worldDown: Vec3 | null): number | null {
  return worldDown ? gravityTiltDeg(worldDown) : null;
}

/**
 * Posición de la burbuja del nivelador, en píxeles desde el centro. `worldDown` nivelado
 * es (0, 1, 0): la componente x mueve la burbuja a los lados (giro del celular) y la z
 * arriba y abajo (celular inclinado hacia delante o atrás). Como en un nivel de burbuja
 * real, la burbuja se aleja del lado que baja. Se limita al borde del círculo.
 */
export function bubbleOffset(worldDown: Vec3 | null, radiusPx: number): { x: number; y: number } {
  if (!worldDown) return { x: 0, y: 0 };
  const len = Math.hypot(worldDown.x, worldDown.y, worldDown.z) || 1;
  let x = (-worldDown.x / len) * radiusPx * 2;
  let y = (worldDown.z / len) * radiusPx * 2;
  const r = Math.hypot(x, y);
  if (r > radiusPx) {
    x = (x / r) * radiusPx;
    y = (y / r) * radiusPx;
  }
  return { x, y };
}

export interface PrepState {
  /** null = el dispositivo no da lectura del sensor: no se exige. */
  levelOk: boolean | null;
  bodyOk: boolean;
  /** Progreso de 0 a 1; `null` en el motor 2D (no calibra). */
  calibration: number | null;
}

export function isReady(s: PrepState): boolean {
  return s.levelOk !== false && s.bodyOk && (s.calibration === null || s.calibration >= 1);
}
