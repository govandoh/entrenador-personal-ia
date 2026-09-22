/**
 * Constructor geométrico de fixtures sintéticos (esquema v1).
 *
 * La idea: para cada frame se decide el ángulo objetivo de cada articulación relevante
 * y se colocan los tres landmarks (proximal, vértice, distal) de modo que
 * `calculateAngle(proximal, vértice, distal)` devuelva exactamente ese ángulo. Los otros
 * landmarks se dejan en una pose de pie plausible con visibilidad 0.9.
 *
 * Este módulo es puro (sin I/O ni dependencias de Node/DOM) para que lo consuman tanto
 * el script `scripts/gen-synthetic-fixtures.ts` como los tests de determinismo.
 */

// Extensiones `.ts` explícitas: este módulo también lo ejecuta Node directamente
// (type stripping) desde scripts/gen-synthetic-fixtures.ts.
import { calculateAngle } from '../geometry/angles.ts';
import {
  FIXTURE_SCHEMA_VERSION,
  POSE_LANDMARK_COUNT,
  fixtureFileName,
  type FixtureFrame,
  type FixtureIndexEntry,
  type FixtureLandmark,
  type FixtureMeta,
  type LandmarkFixture,
} from './fixtureTypes.ts';

// ─── Índices de landmarks de MediaPipe Pose ──────────────────────────────────

export const LM = {
  NOSE: 0,
  LEFT_EYE_INNER: 1, LEFT_EYE: 2, LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4, RIGHT_EYE: 5, RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7, RIGHT_EAR: 8,
  MOUTH_LEFT: 9, MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_PINKY: 17, RIGHT_PINKY: 18,
  LEFT_INDEX: 19, RIGHT_INDEX: 20,
  LEFT_THUMB: 21, RIGHT_THUMB: 22,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  LEFT_HEEL: 29, RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
} as const;

/** Fecha fija para que regenerar produzca bytes idénticos. */
export const SYNTHETIC_RECORDED_AT = '2026-09-19T00:00:00.000Z';

const DEFAULT_VISIBILITY = 0.9;
const KEY_VISIBILITY     = 0.98;
/** Longitud de segmento (muslo, pierna, brazo, antebrazo) en unidades normalizadas. */
const SEGMENT_LENGTH     = 0.2;
const DECIMALS           = 4;

// ─── PRNG determinista ───────────────────────────────────────────────────────

/** mulberry32: PRNG de 32 bits, suficiente para jitter reproducible. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gaussiana estándar por Box-Muller sobre un PRNG uniforme. */
export function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ─── Pose base de pie (frontal) ──────────────────────────────────────────────

function lm(x: number, y: number, visibility = DEFAULT_VISIBILITY, z = 0): FixtureLandmark {
  return { x, y, z, visibility };
}

/**
 * Figura de pie mirando a la cámara. En imagen (no espejada) el lado izquierdo del
 * cuerpo queda a la derecha de la imagen (x mayor).
 */
export function standingPose(): FixtureLandmark[] {
  const p: FixtureLandmark[] = new Array(POSE_LANDMARK_COUNT);
  p[LM.NOSE]            = lm(0.50, 0.14);
  p[LM.LEFT_EYE_INNER]  = lm(0.515, 0.125);
  p[LM.LEFT_EYE]        = lm(0.525, 0.125);
  p[LM.LEFT_EYE_OUTER]  = lm(0.535, 0.125);
  p[LM.RIGHT_EYE_INNER] = lm(0.485, 0.125);
  p[LM.RIGHT_EYE]       = lm(0.475, 0.125);
  p[LM.RIGHT_EYE_OUTER] = lm(0.465, 0.125);
  p[LM.LEFT_EAR]        = lm(0.55, 0.135);
  p[LM.RIGHT_EAR]       = lm(0.45, 0.135);
  p[LM.MOUTH_LEFT]      = lm(0.515, 0.16);
  p[LM.MOUTH_RIGHT]     = lm(0.485, 0.16);
  p[LM.LEFT_SHOULDER]   = lm(0.60, 0.26);
  p[LM.RIGHT_SHOULDER]  = lm(0.40, 0.26);
  p[LM.LEFT_ELBOW]      = lm(0.63, 0.42);
  p[LM.RIGHT_ELBOW]     = lm(0.37, 0.42);
  p[LM.LEFT_WRIST]      = lm(0.65, 0.58);
  p[LM.RIGHT_WRIST]     = lm(0.35, 0.58);
  p[LM.LEFT_PINKY]      = lm(0.655, 0.62);
  p[LM.RIGHT_PINKY]     = lm(0.345, 0.62);
  p[LM.LEFT_INDEX]      = lm(0.66, 0.62);
  p[LM.RIGHT_INDEX]     = lm(0.34, 0.62);
  p[LM.LEFT_THUMB]      = lm(0.645, 0.61);
  p[LM.RIGHT_THUMB]     = lm(0.355, 0.61);
  p[LM.LEFT_HIP]        = lm(0.56, 0.55);
  p[LM.RIGHT_HIP]       = lm(0.44, 0.55);
  p[LM.LEFT_KNEE]       = lm(0.57, 0.75);
  p[LM.RIGHT_KNEE]      = lm(0.43, 0.75);
  p[LM.LEFT_ANKLE]      = lm(0.58, 0.94);
  p[LM.RIGHT_ANKLE]     = lm(0.42, 0.94);
  p[LM.LEFT_HEEL]       = lm(0.575, 0.96);
  p[LM.RIGHT_HEEL]      = lm(0.425, 0.96);
  p[LM.LEFT_FOOT_INDEX] = lm(0.60, 0.97);
  p[LM.RIGHT_FOOT_INDEX]= lm(0.40, 0.97);
  return p;
}

// ─── Colocación de tríos por ángulo ──────────────────────────────────────────

const DEG = Math.PI / 180;

/** Punto a distancia `len` del vértice `b` en dirección `dirDeg` (0° = +x, 90° = +y hacia abajo). */
function polar(b: FixtureLandmark, dirDeg: number, len: number, visibility: number, z: number): FixtureLandmark {
  return {
    x: b.x + len * Math.cos(dirDeg * DEG),
    y: b.y + len * Math.sin(dirDeg * DEG),
    z,
    visibility,
  };
}

interface JointSpec {
  proximal: number;
  vertex:   number;
  distal:   number;
  /** Posición del vértice en la imagen. */
  vertexAt: { x: number; y: number };
  /** Dirección (grados) del segmento vértice→proximal. */
  proximalDir: number;
  /** +1: el distal gira en sentido horario de pantalla desde el proximal; −1: antihorario. */
  sweep: 1 | -1;
  z?: number;
  visibility?: number;
}

/**
 * Coloca proximal, vértice y distal de modo que el ángulo interior en el vértice sea
 * `angleDeg`. `calculateAngle` es simétrico a la reflexión, así que `sweep` solo elige
 * hacia qué lado de la pantalla se abre la articulación.
 */
function placeJoint(pose: FixtureLandmark[], spec: JointSpec, angleDeg: number): void {
  const vis = spec.visibility ?? KEY_VISIBILITY;
  const z   = spec.z ?? 0;
  const vertex: FixtureLandmark = { x: spec.vertexAt.x, y: spec.vertexAt.y, z, visibility: vis };
  pose[spec.vertex]   = vertex;
  pose[spec.proximal] = polar(vertex, spec.proximalDir, SEGMENT_LENGTH, vis, z);
  pose[spec.distal]   = polar(vertex, spec.proximalDir + spec.sweep * angleDeg, SEGMENT_LENGTH, vis, z);
}

/**
 * Vista lateral (perfil izquierdo hacia la cámara): rodilla como vértice, tobillo fijo
 * abajo y la cadera gira: a 180° queda arriba, a 90° el muslo está horizontal hacia atrás.
 * `calculateAngle` es simétrico, así que da igual qué extremo se llame proximal.
 */
const SQUAT_LEFT_KNEE: JointSpec = {
  proximal: LM.LEFT_ANKLE, vertex: LM.LEFT_KNEE, distal: LM.LEFT_HIP,
  vertexAt: { x: 0.50, y: 0.66 },
  proximalDir: 90,
  sweep: 1,
  z: -0.02,
};
const SQUAT_RIGHT_KNEE: JointSpec = {
  ...SQUAT_LEFT_KNEE,
  proximal: LM.RIGHT_ANKLE, vertex: LM.RIGHT_KNEE, distal: LM.RIGHT_HIP,
  vertexAt: { x: 0.51, y: 0.66 },
  z: 0.02,
};

/** Vista frontal: codo como vértice, hombro arriba, muñeca gira hacia afuera al flexionar. */
const CURL_LEFT_ELBOW: JointSpec = {
  proximal: LM.LEFT_SHOULDER, vertex: LM.LEFT_ELBOW, distal: LM.LEFT_WRIST,
  vertexAt: { x: 0.62, y: 0.46 },
  proximalDir: 270,
  sweep: 1,
};
const CURL_RIGHT_ELBOW: JointSpec = {
  proximal: LM.RIGHT_SHOULDER, vertex: LM.RIGHT_ELBOW, distal: LM.RIGHT_WRIST,
  vertexAt: { x: 0.38, y: 0.46 },
  proximalDir: 270,
  sweep: -1,
};

/** Vista frontal: codo a la altura del hombro, hombro hacia el centro, muñeca sube. */
const PRESS_LEFT_ELBOW: JointSpec = {
  proximal: LM.LEFT_SHOULDER, vertex: LM.LEFT_ELBOW, distal: LM.LEFT_WRIST,
  vertexAt: { x: 0.78, y: 0.30 },
  proximalDir: 180,
  sweep: 1,  // 90° → muñeca recta hacia arriba; 180° → brazo horizontal hacia afuera
};
const PRESS_RIGHT_ELBOW: JointSpec = {
  proximal: LM.RIGHT_SHOULDER, vertex: LM.RIGHT_ELBOW, distal: LM.RIGHT_WRIST,
  vertexAt: { x: 0.22, y: 0.30 },
  proximalDir: 0,
  sweep: -1,
};

// ─── Trayectorias ────────────────────────────────────────────────────────────

/**
 * Ciclo coseno entre `start` (t=0) y `peak` (t=T/2) y de vuelta. Fuera de
 * [0, T] devuelve `start`.
 */
function cosineCycle(t: number, T: number, start: number, peak: number): number {
  if (t < 0 || t > T) return start;
  const mid = (start + peak) / 2;
  const amp = (start - peak) / 2;
  return mid + amp * Math.cos((2 * Math.PI * t) / T);
}

/** Serie de `reps` ciclos consecutivos, con `leadMs` de espera antes y después. */
function repSeries(t: number, opts: { reps: number; periodMs: number; leadMs: number; start: number; peak: number }): number {
  const local = t - opts.leadMs;
  if (local < 0 || local >= opts.reps * opts.periodMs) return opts.start;
  return cosineCycle(local % opts.periodMs, opts.periodMs, opts.start, opts.peak);
}

function round(n: number): number {
  const f = 10 ** DECIMALS;
  return Math.round(n * f) / f;
}

function roundPose(pose: FixtureLandmark[]): FixtureLandmark[] {
  return pose.map(p => ({ x: round(p.x), y: round(p.y), z: round(p.z), visibility: round(p.visibility) }));
}

/** Un frame con los ángulos objetivo por articulación (para la verificación). */
export interface SyntheticFrame extends FixtureFrame {
  /** Ángulos objetivo por trío `[proximal, vertex, distal]`, en grados. */
  targets: { joints: [number, number, number]; angle: number }[];
}

export interface SyntheticFixture extends LandmarkFixture {
  frames: SyntheticFrame[];
  /** Tolerancia de verificación en grados (mayor para fixtures con ruido). */
  tolerance: number;
  expected: FixtureIndexEntry['expected'];
  file: string;
}

interface JointTrajectory {
  spec: JointSpec;
  /** Ángulo objetivo (ya con ruido si aplica) para el frame `i` en el tiempo `t`. */
  angleAt: (t: number, i: number) => number;
}

function buildFixture(args: {
  meta: Omit<FixtureMeta, 'schemaVersion' | 'source' | 'recordedAt'>;
  nn?: number;
  durationMs: number;
  joints: JointTrajectory[];
  /** Ajustes sobre la pose base antes de colocar articulaciones (p. ej. bajar visibilidad). */
  decoratePose?: (pose: FixtureLandmark[]) => void;
  tolerance?: number;
  expected: FixtureIndexEntry['expected'];
}): SyntheticFixture {
  const fps        = args.meta.fps;
  const frameMs    = 1000 / fps;
  const frameCount = Math.floor(args.durationMs / frameMs) + 1;
  const frames: SyntheticFrame[] = [];

  for (let i = 0; i < frameCount; i++) {
    const t    = Math.round(i * frameMs * 1000) / 1000;
    const pose = standingPose();
    args.decoratePose?.(pose);
    const targets: SyntheticFrame['targets'] = [];
    for (const j of args.joints) {
      const angle = j.angleAt(t, i);
      placeJoint(pose, j.spec, angle);
      targets.push({ joints: [j.spec.proximal, j.spec.vertex, j.spec.distal], angle });
    }
    frames.push({ t, image: roundPose(pose), targets });
  }

  const meta: FixtureMeta = {
    schemaVersion: FIXTURE_SCHEMA_VERSION,
    exercise:   args.meta.exercise,
    view:       args.meta.view,
    quality:    args.meta.quality,
    source:     'synthetic',
    fps,
    recordedAt: SYNTHETIC_RECORDED_AT,
    notes:      args.meta.notes,
  };

  return {
    meta,
    frames,
    tolerance: args.tolerance ?? 0.5,
    expected:  args.expected,
    file:      fixtureFileName(meta, args.nn ?? 1),
  };
}

/** Quita los campos auxiliares (`targets`) y deja un `LandmarkFixture` v1 puro. */
export function toLandmarkFixture(f: SyntheticFixture): LandmarkFixture {
  return {
    meta:   f.meta,
    frames: f.frames.map(({ t, image }) => ({ t, image })),
  };
}

/**
 * Verifica que `calculateAngle` sobre los landmarks redondeados reproduce el ángulo
 * objetivo dentro de la tolerancia. Devuelve la lista de fallos (vacía si todo bien).
 */
export function verifyFixtureAngles(f: SyntheticFixture): string[] {
  const errors: string[] = [];
  f.frames.forEach((frame, i) => {
    for (const { joints, angle } of frame.targets) {
      const got  = calculateAngle(frame.image[joints[0]], frame.image[joints[1]], frame.image[joints[2]]);
      const diff = Math.abs(got - angle);
      if (diff > f.tolerance) {
        errors.push(`${f.file} frame ${i} joints ${joints.join('-')}: esperado ${angle.toFixed(2)}°, obtenido ${got.toFixed(2)}° (Δ ${diff.toFixed(2)}°)`);
      }
    }
  });
  return errors;
}

// ─── Catálogo de fixtures sintéticos ─────────────────────────────────────────

const SQUAT_PERIOD_MS = 1600;
const ARM_PERIOD_MS   = 1600;
const LEAD_MS         = 500;

function squatGoodTrajectory(t: number): number {
  return repSeries(t, { reps: 5, periodMs: SQUAT_PERIOD_MS, leadMs: LEAD_MS, start: 172, peak: 82 });
}
const SQUAT_DURATION_MS = LEAD_MS + 5 * SQUAT_PERIOD_MS + LEAD_MS;
const ARM_DURATION_MS   = LEAD_MS + 5 * ARM_PERIOD_MS + LEAD_MS;

function squatSideGood(fps: number, quality: 'good' | 'good-30fps'): SyntheticFixture {
  return buildFixture({
    meta: {
      exercise: 'squat', view: 'side', quality, fps,
      notes: `Rodilla 172°→82°→172°, 5 reps de ${SQUAT_PERIOD_MS} ms, ${fps} fps, vista lateral.`,
    },
    durationMs: SQUAT_DURATION_MS,
    joints: [
      { spec: SQUAT_LEFT_KNEE,  angleAt: squatGoodTrajectory },
      { spec: SQUAT_RIGHT_KNEE, angleAt: squatGoodTrajectory },
    ],
    expected: { reps: 5 },
  });
}

function squatSideShallow(): SyntheticFixture {
  const angleAt = (t: number) =>
    repSeries(t, { reps: 5, periodMs: SQUAT_PERIOD_MS, leadMs: LEAD_MS, start: 172, peak: 108 });
  return buildFixture({
    meta: {
      exercise: 'squat', view: 'side', quality: 'shallow', fps: 60,
      notes: 'Rodilla 172°→108°→172°, 5 ciclos; nunca cruza BOTTOM_ANGLE=100 → 0 reps esperadas.',
    },
    durationMs: SQUAT_DURATION_MS,
    joints: [
      { spec: SQUAT_LEFT_KNEE,  angleAt },
      { spec: SQUAT_RIGHT_KNEE, angleAt },
    ],
    expected: { reps: 0 },
  });
}

/** Frame → spike (grados) aplicado a ambas rodillas en un solo frame. */
const NOISY_SPIKES: Record<number, number> = {
  // rep 2, cerca del fondo (t ≈ 2900 ms → frame 174): +15°
  174: 15,
  // rep 4, en la subida a ~159° antes de cruzar STANDING_ANGLE (t ≈ 6700 ms → frame 402): −15°
  402: -15,
};
const NOISE_SIGMA_DEG = 1.5;
const NOISE_CLIP_DEG  = 3;

function squatSideNoisy(): SyntheticFixture {
  const rng = createRng(20260919);
  const jitter = () => Math.max(-NOISE_CLIP_DEG, Math.min(NOISE_CLIP_DEG, gaussian(rng) * NOISE_SIGMA_DEG));
  // Ruido independiente por pierna, precomputado por frame para que el orden de
  // evaluación no afecte al determinismo.
  const frameCount = Math.floor(SQUAT_DURATION_MS / (1000 / 60)) + 1;
  const leftNoise  = Array.from({ length: frameCount }, jitter);
  const rightNoise = Array.from({ length: frameCount }, jitter);

  const noisy = (noise: number[]) => (t: number, i: number) =>
    squatGoodTrajectory(t) + noise[i] + (NOISY_SPIKES[i] ?? 0);

  return buildFixture({
    meta: {
      exercise: 'squat', view: 'side', quality: 'noisy', fps: 60,
      notes: `Como good con jitter gaussiano σ=${NOISE_SIGMA_DEG}° recortado a ±${NOISE_CLIP_DEG}° por pierna y spikes de ±15° de un frame en los frames ${Object.keys(NOISY_SPIKES).join(', ')}. Semilla fija.`,
    },
    durationMs: SQUAT_DURATION_MS,
    joints: [
      { spec: SQUAT_LEFT_KNEE,  angleAt: noisy(leftNoise) },
      { spec: SQUAT_RIGHT_KNEE, angleAt: noisy(rightNoise) },
    ],
    // El ruido es intencional: la verificación solo comprueba que la geometría reproduce
    // el ángulo ya perturbado, así que la tolerancia sigue siendo estricta.
    expected: { reps: 5 },
  });
}

function curlFrontBilateral(): SyntheticFixture {
  const angleAt = (t: number) =>
    repSeries(t, { reps: 5, periodMs: ARM_PERIOD_MS, leadMs: LEAD_MS, start: 170, peak: 40 });
  return buildFixture({
    meta: {
      exercise: 'curl', view: 'front', quality: 'bilateral', fps: 60,
      notes: 'Ambos codos 170°→40°→170° simultáneos, 5 reps. El cooldown de DEC-022 debe absorber la señal del segundo brazo → 5 reps.',
    },
    durationMs: ARM_DURATION_MS,
    joints: [
      { spec: CURL_LEFT_ELBOW,  angleAt },
      { spec: CURL_RIGHT_ELBOW, angleAt },
    ],
    expected: { reps: 5 },
  });
}

function curlFrontAlternating(): SyntheticFixture {
  const CYCLE_MS  = 2400;  // curl de 1600 ms + 800 ms de descanso por brazo
  const OFFSET_MS = 800;
  const cycles    = 3;
  const arm = (offset: number) => (t: number) => {
    const local = t - LEAD_MS - offset;
    if (local < 0 || local >= cycles * CYCLE_MS) return 170;
    return cosineCycle(local % CYCLE_MS, ARM_PERIOD_MS, 170, 40);
  };
  return buildFixture({
    meta: {
      exercise: 'curl', view: 'front', quality: 'alternating', fps: 60,
      notes: `Brazos alternos: cada brazo hace 3 curls de ${ARM_PERIOD_MS} ms con ${CYCLE_MS - ARM_PERIOD_MS} ms de descanso; el derecho va ${OFFSET_MS} ms desfasado. Esperado 6 reps (3 por brazo).`,
    },
    durationMs: LEAD_MS + OFFSET_MS + cycles * CYCLE_MS + LEAD_MS,
    joints: [
      { spec: CURL_LEFT_ELBOW,  angleAt: arm(0) },
      { spec: CURL_RIGHT_ELBOW, angleAt: arm(OFFSET_MS) },
    ],
    expected: { reps: 6 },
  });
}

function curlSideLeft(): SyntheticFixture {
  const angleAt = (t: number) =>
    repSeries(t, { reps: 5, periodMs: ARM_PERIOD_MS, leadMs: LEAD_MS, start: 170, peak: 40 });
  const RIGHT_ARM = [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST, LM.RIGHT_PINKY, LM.RIGHT_INDEX, LM.RIGHT_THUMB];
  return buildFixture({
    meta: {
      exercise: 'curl', view: 'side', quality: 'left', fps: 60,
      notes: 'Solo el brazo izquierdo visible (derecho con visibilidad 0.2 → vista lateral por LATERAL_VIS_DIFF). 5 reps 170°→40°→170°.',
    },
    durationMs: ARM_DURATION_MS,
    decoratePose: pose => { for (const i of RIGHT_ARM) pose[i] = { ...pose[i], visibility: 0.2 }; },
    joints: [
      { spec: CURL_LEFT_ELBOW, angleAt },
    ],
    expected: { reps: 5 },
  });
}

function curlFrontPartial(): SyntheticFixture {
  const angleAt = (t: number) =>
    repSeries(t, { reps: 5, periodMs: ARM_PERIOD_MS, leadMs: LEAD_MS, start: 120, peak: 40 });
  return buildFixture({
    meta: {
      exercise: 'curl', view: 'front', quality: 'partial', fps: 60,
      notes: 'Ambos codos parten de 120° (< MIN_START_ANGLE=130) → 40° → 120°, 5 ciclos. Esperado 0 reps (rango de inicio insuficiente).',
    },
    durationMs: ARM_DURATION_MS,
    joints: [
      { spec: CURL_LEFT_ELBOW,  angleAt },
      { spec: CURL_RIGHT_ELBOW, angleAt },
    ],
    expected: { reps: 0 },
  });
}

function pressFrontGood(): SyntheticFixture {
  const angleAt = (t: number) =>
    repSeries(t, { reps: 5, periodMs: ARM_PERIOD_MS, leadMs: LEAD_MS, start: 85, peak: 160 });
  return buildFixture({
    meta: {
      exercise: 'press', view: 'front', quality: 'good', fps: 60,
      notes: 'Ambos codos 85°→160°→85°, 5 reps bilaterales.',
    },
    durationMs: ARM_DURATION_MS,
    joints: [
      { spec: PRESS_LEFT_ELBOW,  angleAt },
      { spec: PRESS_RIGHT_ELBOW, angleAt },
    ],
    expected: { reps: 5 },
  });
}

function pressFrontLowElbow(): SyntheticFixture {
  const angleAt = (t: number) =>
    repSeries(t, { reps: 5, periodMs: ARM_PERIOD_MS, leadMs: LEAD_MS, start: 70, peak: 160 });
  return buildFixture({
    meta: {
      exercise: 'press', view: 'front', quality: 'lowelbow', fps: 60,
      notes: 'Ambos codos 70°→160°→70°: baja por debajo de SAFE_LOW_ANGLE=80 → debe aparecer feedback "bad" en la fase lowered.',
    },
    durationMs: ARM_DURATION_MS,
    joints: [
      { spec: PRESS_LEFT_ELBOW,  angleAt },
      { spec: PRESS_RIGHT_ELBOW, angleAt },
    ],
    expected: { reps: 5, badFeedback: true },
  });
}

/** Todos los fixtures sintéticos, en el orden del índice. Determinista. */
export function buildAllSyntheticFixtures(): SyntheticFixture[] {
  return [
    squatSideGood(60, 'good'),
    squatSideShallow(),
    squatSideNoisy(),
    squatSideGood(30, 'good-30fps'),
    curlFrontBilateral(),
    curlFrontAlternating(),
    curlSideLeft(),
    curlFrontPartial(),
    pressFrontGood(),
    pressFrontLowElbow(),
  ];
}

export function toIndexEntry(f: SyntheticFixture): FixtureIndexEntry {
  const last = f.frames[f.frames.length - 1];
  return {
    file:       f.file,
    exercise:   f.meta.exercise,
    view:       f.meta.view,
    quality:    f.meta.quality,
    source:     f.meta.source,
    fps:        f.meta.fps,
    frames:     f.frames.length,
    durationMs: last.t,
    expected:   f.expected,
    notes:      f.meta.notes,
  };
}

/**
 * Serializa un fixture v1 con un frame por línea: diffs legibles y archivos compactos.
 */
export function serializeFixture(fixture: LandmarkFixture): string {
  const frames = fixture.frames.map(fr => JSON.stringify(fr)).join(',\n');
  return `{\n"meta": ${JSON.stringify(fixture.meta, null, 2)},\n"frames": [\n${frames}\n]\n}\n`;
}
