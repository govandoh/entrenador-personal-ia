import { GravityEstimator, type CameraFacing } from '../geometry/gravityAlign';
import type { Vec3 } from '../geometry/vectors3d';

/**
 * Adaptador del acelerómetro para la nivelación del esqueleto (ver DEC-050, paso I-3 de
 * DEC-054).
 *
 * Solo contiene lo que depende del navegador: escuchar `devicemotion`, leer
 * `screen.orientation` y pedir el permiso de iOS. El filtrado de lecturas, el signo
 * Android/iOS y el suavizado viven en `GravityEstimator` (puro, con tests).
 *
 * Se usa `devicemotion` (`accelerationIncludingGravity`) y no `deviceorientation`: los
 * ángulos de Euler de este último entran en bloqueo de cardán con el celular en vertical,
 * que es como se usa la app. Portado de fitnetv2 (`src/pose/deviceGravity.ts`, 821abcb).
 *
 * Sin verificar todavía en iPhone ni en Android reales.
 */

interface MotionPermissionApi {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

/** iOS 13+ exige pedir permiso explícito para leer los sensores de movimiento. */
export function motionPermissionRequired(): boolean {
  return typeof DeviceMotionEvent !== 'undefined' &&
    typeof (DeviceMotionEvent as unknown as MotionPermissionApi).requestPermission === 'function';
}

/**
 * Pide permiso para los sensores. En iOS debe llamarse directamente desde un toque del
 * usuario, antes de cualquier `await`, o Safari lo rechaza sin preguntar. En Android y
 * escritorio no hace falta y devuelve `true`.
 */
export async function requestMotionPermission(): Promise<boolean> {
  if (typeof DeviceMotionEvent === 'undefined') return false;
  const api = DeviceMotionEvent as unknown as MotionPermissionApi;
  if (typeof api.requestPermission !== 'function') return true;
  try {
    return (await api.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

function screenAngleDeg(): number {
  try {
    return screen.orientation?.angle ?? 0;
  } catch {
    return 0;
  }
}

/** Escucha el acelerómetro mientras la vista de cámara está montada. */
export class DeviceGravityTracker {
  private readonly estimator = new GravityEstimator();
  private listening = false;

  start(): void {
    if (this.listening || typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return;
    window.addEventListener('devicemotion', this.onMotion);
    this.listening = true;
  }

  stop(): void {
    if (!this.listening) return;
    window.removeEventListener('devicemotion', this.onMotion);
    this.listening = false;
  }

  /** true desde que llegó al menos una lectura válida. */
  get hasReading(): boolean {
    return this.estimator.hasReading;
  }

  /** "Abajo" en ejes de `worldLandmarks`, o `null` sin lectura confiable. */
  worldDown(facing: CameraFacing): Vec3 | null {
    return this.estimator.worldDown(facing);
  }

  private onMotion = (e: DeviceMotionEvent): void => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null) return;
    // `timeStamp` del evento: el estimador suaviza con el tiempo de la lectura.
    this.estimator.addSample({ x: a.x, y: a.y, z: a.z }, screenAngleDeg(), e.timeStamp);
  };
}
