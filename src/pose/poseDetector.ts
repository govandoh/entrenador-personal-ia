import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
  type Landmark,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

// Versión debe coincidir exactamente con el paquete instalado (0.10.35)
const WASM_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

let landmarker: PoseLandmarker | null = null;
let drawingUtils: DrawingUtils | null = null;

// Landmarks 3D en metros (origen en la cadera) de la última detección. MediaPipe ya los
// calcula en cada `detectForVideo`, así que guardarlos cuesta una asignación por frame.
// Existen para que el modo `?debug=record` pueda exportarlos sin rediseñar este módulo;
// el PR 3 del plan sustituye este singleton por `detect(video, t) → { image, world }`
// + `SkeletonRenderer`, y entonces esta función desaparece.
let lastWorldLandmarks: Landmark[] | null = null;

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

export function detectAndDraw(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  timestampMs: number
): NormalizedLandmark[][] {
  if (!landmarker || video.readyState < 2) return [];

  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  // Sincronizar dimensiones internas del canvas con el stream real
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const result = landmarker.detectForVideo(video, timestampMs);
  lastWorldLandmarks = result.worldLandmarks[0] ?? null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!drawingUtils) drawingUtils = new DrawingUtils(ctx);

  for (const landmarks of result.landmarks) {
    drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
      color: '#00FF00',
      lineWidth: 2,
    });
    drawingUtils.drawLandmarks(landmarks, {
      color: '#FF3333',
      lineWidth: 1,
      radius: 3,
    });
  }

  return result.landmarks;
}

/**
 * `worldLandmarks` de la última llamada a `detectAndDraw` (null si no hubo persona).
 * Solo la usa el modo de grabación de fixtures; ver el comentario de `lastWorldLandmarks`.
 */
export function getLastWorldLandmarks(): Landmark[] | null {
  return lastWorldLandmarks;
}
