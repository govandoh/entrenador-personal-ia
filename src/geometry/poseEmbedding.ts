import {
  LM, calculateAngle3D, getTorsoInclination, midpoint, subtract, magnitude,
  type Landmark3D, type Vec3,
} from './vectors3d.ts';

/**
 * Normalización y vector de rasgos de una pose para el clasificador k-NN (ver DEC-055).
 *
 * El clasificador compara posturas de personas distintas, a distancias y orientaciones
 * distintas de la cámara. Para que eso funcione, la pose se lleva a un marco canónico
 * (ML-PIPELINE.md §3) antes de medir nada:
 *
 * 1. Nivelar: se supone ya hecho (`gravityAlign.ts` y `standingCalibration.ts`), porque
 *    el giro alrededor de la vertical del paso 4 solo tiene sentido si Y es la vertical real.
 * 2. Centrar en el punto medio de las caderas.
 * 3. Escalar por la longitud del torso (caderas → hombros): la estatura deja de importar.
 * 4. Girar alrededor de la vertical para que el eje de caderas quede paralelo a X: la
 *    orientación respecto a la cámara deja de importar.
 *
 * El vector resultante son las coordenadas normalizadas del subconjunto COCO-17 (el mismo
 * esqueleto que usan los modelos preentrenados, DEC-034) más los ángulos articulares
 * clave, que la literatura muestra más discriminantes para juzgar técnica que las
 * posiciones solas. Módulo puro.
 */

/** Versión del vector; un modelo entrenado con otra versión se rechaza al cargar. */
export const POSE_EMBEDDING_VERSION = 1;

/** Índices de MediaPipe que forman el esqueleto COCO-17, en orden COCO. */
export const COCO17_FROM_MEDIAPIPE = [
  0,          // nariz
  2, 5,       // ojos izquierdo, derecho
  7, 8,       // orejas
  11, 12,     // hombros
  13, 14,     // codos
  15, 16,     // muñecas
  23, 24,     // caderas
  25, 26,     // rodillas
  27, 28,     // tobillos
] as const;

/** Pares izquierda/derecha de MediaPipe Pose, para espejar. */
const MIRROR_PAIRS: readonly (readonly [number, number])[] = [
  [1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18],
  [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32],
];

/** Torso mínimo aceptado, en metros: por debajo la detección es degenerada. */
const MIN_TORSO_M = 1e-3;

/**
 * Lleva la pose al marco canónico (pasos 2–4). Devuelve `null` si el torso es degenerado.
 * La visibilidad se conserva.
 */
export function normalizePose<T extends Landmark3D>(world: readonly T[]): T[] | null {
  const hipMid = midpoint(world[LM.LEFT_HIP], world[LM.RIGHT_HIP]);
  const shoulderMid = midpoint(world[LM.LEFT_SHOULDER], world[LM.RIGHT_SHOULDER]);
  const torso = magnitude(subtract(shoulderMid, hipMid));
  if (torso < MIN_TORSO_M) return null;

  // Giro alrededor de Y que lleva el vector cadera derecha → izquierda al eje +X.
  const hips = subtract(world[LM.LEFT_HIP], world[LM.RIGHT_HIP]);
  const yaw = Math.atan2(hips.z, hips.x);
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);

  return world.map(p => {
    const x = (p.x - hipMid.x) / torso;
    const y = (p.y - hipMid.y) / torso;
    const z = (p.z - hipMid.z) / torso;
    return { ...p, x: x * cos + z * sin, y, z: -x * sin + z * cos };
  });
}

/**
 * Espeja la pose: intercambia izquierda y derecha y niega X. Aplicado dos veces devuelve
 * la pose original. Sirve para duplicar el dataset sin sesgo de lado (ML-PIPELINE.md §3).
 */
export function mirrorPose<T extends Landmark3D>(world: readonly T[]): T[] {
  const out = world.map(p => ({ ...p, x: -p.x }));
  for (const [l, r] of MIRROR_PAIRS) {
    if (l < out.length && r < out.length) [out[l], out[r]] = [out[r], out[l]];
  }
  return out;
}

/** Ángulos articulares incluidos en el vector, como tripletas (A, vértice, C). */
const ANGLE_TRIPLETS: readonly (readonly [number, number, number])[] = [
  [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_KNEE],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_ELBOW, LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_ELBOW, LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
];

/** Dimensión del vector: 17 puntos × 3 coordenadas + 8 ángulos + inclinación del tronco. */
export const POSE_EMBEDDING_SIZE = COCO17_FROM_MEDIAPIPE.length * 3 + ANGLE_TRIPLETS.length + 1;

/**
 * Vector de rasgos de una pose ya nivelada. Las coordenadas quedan en unidades de torso
 * (≈ −3…3) y los ángulos se dividen entre 180 para que pesen en la misma escala.
 * Devuelve `null` si la pose no se puede normalizar.
 */
export function embedPose(world: readonly Landmark3D[]): number[] | null {
  const n = normalizePose(world);
  if (!n) return null;

  const out: number[] = [];
  for (const i of COCO17_FROM_MEDIAPIPE) out.push(n[i].x, n[i].y, n[i].z);
  for (const [a, b, c] of ANGLE_TRIPLETS) out.push(calculateAngle3D(n[a], n[b], n[c]) / 180);
  out.push(
    getTorsoInclination(n[LM.LEFT_SHOULDER], n[LM.RIGHT_SHOULDER], n[LM.LEFT_HIP], n[LM.RIGHT_HIP]) / 180,
  );
  return out;
}

/** Rota una pose `deg` grados alrededor de la vertical (aumento de datos y tests). */
export function rotateYaw<T extends Vec3>(world: readonly T[], deg: number): T[] {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return world.map(p => ({ ...p, x: p.x * cos + p.z * sin, z: -p.x * sin + p.z * cos }));
}
