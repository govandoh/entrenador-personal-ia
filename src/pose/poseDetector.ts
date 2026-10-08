import {
  PoseLandmarker,
  FilesetResolver,
  type Landmark,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { CanvasSkeletonRenderer } from './skeletonRenderer';

// Versión debe coincidir exactamente con el paquete instalado (0.10.35)
const WASM_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// Singleton de módulo: descargar el modelo y compilar el WASM es caro y solo hay una
// cámara activa (ARCHITECTURE.md §3).
let landmarker: PoseLandmarker | null = null;

export async function initPoseDetector(): Promise<void> {
  if (landmarker) return;

  const vision = await FilesetResolver.forVisionTasks(WASM_CDN);

  landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
  });
}

/** Resultado de una detección sobre un frame de video (una sola persona, `numPoses: 1`). */
export interface PoseDetection {
  /** `result.landmarks[0]`: 33 puntos normalizados a la imagen, o `null` si no hay persona. */
  image: NormalizedLandmark[] | null;
  /** `result.worldLandmarks[0]`: 33 puntos en metros, origen en la cadera, o `null`. */
  world: Landmark[] | null;
}

/**
 * Detecta la pose en el frame actual del video. No dibuja nada (PR 3, issue #12).
 *
 * Devuelve `null` si todavía no se puede detectar (modelo sin cargar o video sin datos);
 * así quien dibuja distingue "aún no hay imagen" (no tocar el canvas) de "no hay persona"
 * (limpiar el canvas), que es lo que hacía `detectAndDraw`.
 */
export function detect(video: HTMLVideoElement, timestampMs: number): PoseDetection | null {
  if (!landmarker || video.readyState < 2) return null;
  const result = landmarker.detectForVideo(video, timestampMs);
  return {
    image: result.landmarks[0] ?? null,
    world: result.worldLandmarks[0] ?? null,
  };
}

// --- Compatibilidad -----------------------------------------------------------------
// `WorkoutScreen` (workstream E) todavía llama a `detectAndDraw` + `getLastWorldLandmarks`.
// Se mantienen como envoltura de `detect` + `CanvasSkeletonRenderer` para no tocar `src/ui`
// en este PR; se eliminan cuando la pantalla consuma `CameraPoseSource` (PR 5, issue #14).

let lastWorldLandmarks: Landmark[] | null = null;
let compatRenderer: CanvasSkeletonRenderer | null = null;

/** @deprecated Usar `detect` + `SkeletonRenderer`, o `CameraPoseSource`. */
export function detectAndDraw(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  timestampMs: number
): NormalizedLandmark[][] {
  if (!landmarker || video.readyState < 2) return [];
  if (!compatRenderer || compatRenderer.canvas !== canvas) {
    const r = CanvasSkeletonRenderer.create(canvas);
    if (!r) return [];
    compatRenderer = r;
  }

  const detection = detect(video, timestampMs);
  if (!detection) return [];
  lastWorldLandmarks = detection.world;

  compatRenderer.resize(video.videoWidth, video.videoHeight);
  if (detection.image) {
    compatRenderer.draw({ t: timestampMs, seq: 0, image: detection.image, view: 'unknown' });
  } else {
    compatRenderer.clear();
  }
  return detection.image ? [detection.image] : [];
}

/**
 * @deprecated `worldLandmarks` de la última llamada a `detectAndDraw` (null si no hubo
 * persona). Con `detect` vienen en el mismo resultado.
 */
export function getLastWorldLandmarks(): Landmark[] | null {
  return lastWorldLandmarks;
}
