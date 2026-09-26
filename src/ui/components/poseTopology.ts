import { LM } from '../../geometry/vectors3d';

/**
 * Huesos del esqueleto de 33 puntos de MediaPipe Pose (mismo trazado que
 * `PoseLandmarker.POSE_CONNECTIONS`). Se declara aquí para que la UI no importe
 * `@mediapipe/tasks-vision`, que solo vive en `src/pose` (AGENTS.md, dirección de dependencias).
 */
export const POSE_BONES: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28],
  [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32],
];

/** Articulaciones que entran en algún cálculo angular: se dibujan más grandes. */
export const KEY_JOINTS: ReadonlySet<number> = new Set([
  LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW,
  LM.LEFT_WRIST, LM.RIGHT_WRIST, LM.LEFT_HIP, LM.RIGHT_HIP,
  LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE,
]);

/** Puntos de apoyo para anclar el esqueleto al suelo. */
export const FOOT_JOINTS: readonly number[] = [
  LM.LEFT_ANKLE, LM.RIGHT_ANKLE, LM.LEFT_HEEL, LM.RIGHT_HEEL, LM.LEFT_FOOT, LM.RIGHT_FOOT,
];
