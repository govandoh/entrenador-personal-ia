/**
 * Tipos de la frontera de pose: lo que emite el "ojo" de Fitnet (PR 3, issue #12).
 *
 * PROVISIONAL: son las firmas de `ARCHITECTURE.md` §2.2 (`LandmarkFrame`, `PoseSource`,
 * `SkeletonRenderer`). Su lugar definitivo es `src/contracts/` (lo crea el PR 2, issue #11,
 * co-propiedad B y D). Viven aquí mientras ese directorio no exista; cuando exista, este
 * archivo se reduce a reexportarlos desde allí, sin cambiar la forma.
 *
 * No importan nada de `@mediapipe/tasks-vision`: `LandmarkPoint` tiene la misma forma que
 * `NormalizedLandmark`, `Landmark` y `FixtureLandmark`, así que se pasan tal cual.
 */

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  /** Confianza de que el punto es visible, 0–1. */
  visibility: number;
}

/** Vista de la cámara respecto al cuerpo. `unknown` mientras nadie la haya clasificado. */
export type FrameView = 'front' | 'side' | 'unknown';

/** Una detección de una persona en un instante. */
export interface LandmarkFrame {
  /** Milisegundos (reloj del origen: `performance.now()` en cámara, `t` del fixture en replay). */
  t: number;
  /** Correlativo desde 0 por cada `start()`; detecta frames perdidos o reordenados. */
  seq: number;
  /** 33 landmarks normalizados a la imagen (`result.landmarks[0]`). */
  image: LandmarkPoint[];
  /** 33 landmarks en metros con origen en la cadera (`result.worldLandmarks[0]`). */
  world?: LandmarkPoint[];
  view: FrameView;
}

/** Fuente de frames: cámara en vivo o un fixture grabado. */
export interface PoseSource {
  start(): Promise<void>;
  stop(): void;
  /** Se llama solo en frames con una persona detectada. Devuelve la función para desuscribirse. */
  onFrame(cb: (frame: LandmarkFrame) => void): () => void;
}

/** Dibuja un frame. Separado de la detección para poder detectar sin canvas. */
export interface SkeletonRenderer {
  draw(frame: LandmarkFrame): void;
}
