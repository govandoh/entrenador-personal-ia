/**
 * Geometría vectorial en 3D sobre los `worldLandmarks` de MediaPipe (ver DEC-036).
 *
 * Diferencia con `angles.ts` (2D): `angles.ts` opera sobre coordenadas normalizadas de
 * pantalla, así que el ángulo medido depende de la posición de la cámara. Un usuario
 * girado 45° respecto al lente produce segmentos proyectados más cortos y ángulos
 * sobreestimados (una sentadilla profunda real puede medirse como 120° en vez de 85°).
 *
 * Este módulo opera sobre `worldLandmarks`: metros, origen en el punto medio de la
 * cadera. El ángulo resultante es el anatómico, no su proyección.
 *
 * Portado de fitnetv2 (`ecaldcc/07-FitNet`, commit d456e95). Módulo puro: sin DOM,
 * sin React y sin tipos de MediaPipe (`Landmark3D` es estructuralmente compatible).
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Landmark 3D con visibilidad opcional; compatible con `Landmark` de MediaPipe. */
export interface Landmark3D extends Vec3 {
  visibility?: number;
}

/** Índices de landmarks de MediaPipe Pose (33 puntos) usados por el análisis 3D. */
export const LM = {
  NOSE:            0,
  LEFT_SHOULDER:  11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW:     13,
  RIGHT_ELBOW:    14,
  LEFT_WRIST:     15,
  RIGHT_WRIST:    16,
  LEFT_HIP:       23,
  RIGHT_HIP:      24,
  LEFT_KNEE:      25,
  RIGHT_KNEE:     26,
  LEFT_ANKLE:     27,
  RIGHT_ANKLE:    28,
  LEFT_HEEL:      29,
  RIGHT_HEEL:     30,
  LEFT_FOOT:      31,
  RIGHT_FOOT:     32,
} as const;

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function magnitude(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function normalize(v: Vec3): Vec3 {
  const m = magnitude(v);
  if (m === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

export function midpoint(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

/** Distancia euclidiana en 3D. En `worldLandmarks` el resultado está en metros. */
export function distance3D(a: Vec3, b: Vec3): number {
  return magnitude(subtract(a, b));
}

/**
 * Ángulo en el vértice B formado por los segmentos BA y BC. Rango 0–180°.
 *
 * Usa producto punto en lugar de `atan2`: en 3D no hay un sentido de giro definido sin
 * un plano de referencia, y para articulaciones solo importa la apertura. El clamp del
 * coseno a [-1, 1] es obligatorio: el error de punto flotante puede dar 1.0000000002 y
 * `Math.acos` de eso es NaN.
 */
export function calculateAngle3D(A: Vec3, B: Vec3, C: Vec3): number {
  return angleBetween(subtract(A, B), subtract(C, B));
}

/** Ángulo entre dos vectores libres (sin vértice común). Rango 0–180°. */
export function angleBetween(u: Vec3, v: Vec3): number {
  const magU = magnitude(u);
  const magV = magnitude(v);
  if (magU === 0 || magV === 0) return 0;

  const cosine = Math.max(-1, Math.min(1, dot(u, v) / (magU * magV)));
  return (Math.acos(cosine) * 180) / Math.PI;
}

export type BodyOrientation = 'frontal' | 'diagonal' | 'lateral';

export interface OrientationInfo {
  /** 0° = hombros perpendiculares al lente (de frente); 90° = de perfil. */
  yawDegrees: number;
  orientation: BodyOrientation;
  /** Hacia qué lado apunta el cuerpo cuando está de perfil. */
  facing: 'left' | 'right' | 'camera';
}

/** Límites de yaw, en grados, entre frente/diagonal y diagonal/perfil. */
const FRONTAL_MAX_YAW  = 30;
const DIAGONAL_MAX_YAW = 60;

/**
 * Orientación del torso respecto a la cámara.
 *
 * En `worldLandmarks` el eje X corre paralelo al plano de la imagen y Z mide
 * profundidad. De frente, el vector entre hombros es casi puro X; de perfil, se vuelca
 * sobre Z. La proporción entre ambas componentes da el giro sin calibración.
 *
 * No corrige ángulos (el cálculo 3D ya es invariante a la orientación): sirve para
 * decidir qué validaciones aplican en cada vista, avisar al usuario de una colocación
 * mala y etiquetar la vista de las grabaciones del dataset (DEC-055).
 */
export function getBodyOrientation(shoulderL: Vec3, shoulderR: Vec3): OrientationInfo {
  const shoulderVec = subtract(shoulderR, shoulderL);

  const yawDegrees =
    (Math.atan2(Math.abs(shoulderVec.z), Math.abs(shoulderVec.x)) * 180) / Math.PI;

  let orientation: BodyOrientation;
  if (yawDegrees < FRONTAL_MAX_YAW) orientation = 'frontal';
  else if (yawDegrees < DIAGONAL_MAX_YAW) orientation = 'diagonal';
  else orientation = 'lateral';

  let facing: OrientationInfo['facing'] = 'camera';
  if (orientation === 'lateral') {
    // z negativo = más cerca del lente. Si el hombro derecho está delante, el usuario
    // mira hacia su izquierda desde el punto de vista de la cámara.
    facing = shoulderVec.z < 0 ? 'left' : 'right';
  }

  return { yawDegrees, orientation, facing };
}

/** Vertical ascendente en `worldLandmarks` (el eje Y apunta hacia abajo). */
export const WORLD_UP: Vec3 = { x: 0, y: -1, z: 0 };

/**
 * Inclinación del torso respecto a la vertical, en grados.
 * 0° = tronco erguido; 90° = tronco horizontal.
 *
 * Supone que +Y de los landmarks es el "abajo" real: solo es cierto después de nivelar
 * con la gravedad o con la calibración de pie (`gravityAlign.ts`, DEC-050/DEC-053).
 */
export function getTorsoInclination(
  shoulderL: Vec3, shoulderR: Vec3,
  hipL: Vec3, hipR: Vec3,
): number {
  const torsoVec = subtract(midpoint(shoulderL, shoulderR), midpoint(hipL, hipR));
  return angleBetween(torsoVec, WORLD_UP);
}

/**
 * Asimetría entre izquierda y derecha, como fracción del promedio.
 * 0 = simétrico; 0.2 = un lado se mueve un 20 % distinto al otro.
 */
export function asymmetryRatio(leftValue: number, rightValue: number): number {
  const mean = (leftValue + rightValue) / 2;
  if (mean === 0) return 0;
  return Math.abs(leftValue - rightValue) / mean;
}

/** true si todos los landmarks indicados superan el umbral de visibilidad. */
export function areVisible(
  landmarks: readonly { visibility?: number }[],
  indices: readonly number[],
  minVisibility = 0.5,
): boolean {
  return indices.every(i => (landmarks[i]?.visibility ?? 0) >= minVisibility);
}
