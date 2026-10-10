/**
 * Contrato de pose: lo que una fuente de poses (cámara o fixture) entrega por frame.
 *
 * Tipos propios, no los de MediaPipe: el análisis debe correr en Node con fixtures sin
 * depender de `@mediapipe/tasks-vision` (ARCHITECTURE.md §2.1, DEC-009). Son
 * estructuralmente compatibles con `NormalizedLandmark` y `Landmark` de MediaPipe.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Landmark extends Vec3 {
  /** Confianza de que el landmark es visible, 0–1. */
  visibility: number;
}

export interface LandmarkFrame {
  /** Instante del frame, en ms. Los trackers miden el tiempo con él, nunca con el reloj. */
  t: number;
  /** 33 landmarks normalizados a la imagen (`result.landmarks[0]`). */
  image: Landmark[];
  /** 33 landmarks en metros con origen en la cadera (`result.worldLandmarks[0]`), si los hay. */
  world?: Landmark[];
  /** "Abajo" medido por el acelerómetro en ejes de `world`, o `null` sin lectura (DEC-050). */
  down?: Vec3 | null;
}
