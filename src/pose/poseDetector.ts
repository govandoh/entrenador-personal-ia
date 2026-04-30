import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from '@mediapipe/tasks-vision';

// Versión debe coincidir exactamente con el paquete instalado (0.10.35)
const WASM_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

let landmarker: PoseLandmarker | null = null;
let drawingUtils: DrawingUtils | null = null;

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
): void {
  if (!landmarker || video.readyState < 2) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Sincronizar dimensiones internas del canvas con el stream real
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const result = landmarker.detectForVideo(video, timestampMs);

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
}
