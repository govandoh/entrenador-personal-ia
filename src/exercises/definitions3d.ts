import {
  LM, angleBetween, areVisible, calculateAngle3D, getTorsoInclination, subtract,
  type Landmark3D,
} from '../geometry/vectors3d';
import type { ExerciseDefinition3D, FormContext, Side } from './tracker3d';
import { GOOD_DEPTH_ANGLE } from './squat';
import { GOOD_FORM_ANGLE } from './bicepCurl';
import { GOOD_LOCKOUT_ANGLE, SAFE_LOW_ANGLE } from './shoulderPress';

/**
 * Definiciones 3D de sentadilla, curl y press (ver DEC-057).
 *
 * Umbrales tomados de los trackers 3D de fitnetv2 (commit d456e95): histéresis de fase,
 * validación temporal por ejercicio (DEC-037/045) y comprobaciones de forma que solo son
 * medibles en 3D (DEC-036). Los umbrales de calidad buena (`GOOD_*`, `SAFE_LOW_ANGLE`) se
 * comparten con los trackers 2D de producción para que ambos motores juzguen igual.
 *
 * Las comprobaciones contra la vertical (tronco, brazo) suponen landmarks nivelados por
 * gravedad o calibración (DEC-050/053).
 */

/** Margen de confirmación del pico o fondo, en grados: supera el temblor típico (1–3°). ver DEC-044 */
const CONFIRM_MARGIN_DEG = 8;
/** Bloqueo tras contar, en ms: ~15 frames a 60 fps del MVP (DEC-022), ahora independiente de los fps. */
const ARM_COOLDOWN_MS = 250;
const MIN_VISIBILITY = 0.5;

/** Inclinación del tronco en la sentadilla que dispara `trunk_lean`, en grados (DEC-057). */
export const SQUAT_MAX_TRUNK_LEAN_DEG = 55;
/** Asimetría de rodillas que dispara el aviso, como fracción. */
const SQUAT_MAX_ASYMMETRY = 0.18;
/** Desviación del brazo respecto a la vertical que dispara `elbow_drift`, en grados. */
export const CURL_MAX_ELBOW_DRIFT_DEG = 25;
/** Inclinación del tronco en el press que dispara `lumbar_arch`, en grados. */
export const PRESS_MAX_TRUNK_LEAN_DEG = 25;
const ARM_MAX_ASYMMETRY = 0.2;

const SIDE = {
  left:  { shoulder: LM.LEFT_SHOULDER,  elbow: LM.LEFT_ELBOW,  wrist: LM.LEFT_WRIST,  hip: LM.LEFT_HIP,  knee: LM.LEFT_KNEE,  ankle: LM.LEFT_ANKLE },
  right: { shoulder: LM.RIGHT_SHOULDER, elbow: LM.RIGHT_ELBOW, wrist: LM.RIGHT_WRIST, hip: LM.RIGHT_HIP, knee: LM.RIGHT_KNEE, ankle: LM.RIGHT_ANKLE },
} as const;

function torsoLean(w: readonly Landmark3D[]): number {
  return getTorsoInclination(w[LM.LEFT_SHOULDER], w[LM.RIGHT_SHOULDER], w[LM.LEFT_HIP], w[LM.RIGHT_HIP]);
}

function elbowAngle(w: readonly Landmark3D[], s: Side): number {
  const j = SIDE[s];
  return calculateAngle3D(w[j.shoulder], w[j.elbow], w[j.wrist]);
}

/** Desviación del brazo (hombro→codo) respecto a la vertical descendente (+Y), en grados. */
function upperArmDrift(w: readonly Landmark3D[], s: Side): number {
  const j = SIDE[s];
  return angleBetween(subtract(w[j.elbow], w[j.shoulder]), { x: 0, y: 1, z: 0 });
}

function armSideLandmarks(s: Side): readonly number[] {
  return [SIDE[s].shoulder, SIDE[s].elbow, SIDE[s].wrist];
}

// ─────────────────────────────── Sentadilla ───────────────────────────────

export const SQUAT_3D: ExerciseDefinition3D = {
  id: 'squat',
  name: 'Sentadillas',
  sides: 'both',
  sideLandmarks: {
    left:  [SIDE.left.hip, SIDE.left.knee, SIDE.left.ankle],
    right: [SIDE.right.hip, SIDE.right.knee, SIDE.right.ankle],
  },
  extraLandmarks: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  sideAngle: (w, s) => calculateAngle3D(w[SIDE[s].hip], w[SIDE[s].knee], w[SIDE[s].ankle]),
  combine: 'mean',
  // De pie > 160°, abajo < 100° (DEC-010).
  cycle: { polarity: 'min', restDeg: 160, effortDeg: 100, confirmMarginDeg: CONFIRM_MARGIN_DEG },
  perSideCycles: false,
  cooldownMs: 0,
  shape: { effortIsMinimum: true, concentricFirst: false },
  quality: { minRomDegrees: 40, minDurationMs: 800, maxDurationMs: 15000, minSmoothness: 0.35 },
  formCheck(ctx: FormContext) {
    if (ctx.phase !== 'effort') return null;
    if (torsoLean(ctx.world) > SQUAT_MAX_TRUNK_LEAN_DEG) {
      return { code: 'trunk_lean', level: 'bad', message: 'Pecho arriba, estás inclinando la espalda' };
    }
    if (ctx.asymmetry > SQUAT_MAX_ASYMMETRY) {
      return { code: 'asymmetry', level: 'warning', message: 'Reparte el peso entre las dos piernas' };
    }
    return null;
  },
  phaseFeedback(ctx: FormContext) {
    if (ctx.phase === 'rest') return { level: 'idle', message: 'Listo, baja para la sentadilla' };
    // Ya pasó el fondo: se juzga la profundidad alcanzada, no se pide bajar mientras sube.
    if (ctx.peakReached) {
      return ctx.extremeDeg <= GOOD_DEPTH_ANGLE
        ? { level: 'good', message: '¡Buena profundidad! Sube con los talones' }
        : { level: 'warning', message: 'Sube. En la próxima, baja un poco más' };
    }
    return ctx.primaryAngle <= GOOD_DEPTH_ANGLE
      ? { level: 'good', message: '¡Excelente profundidad!' }
      : { level: 'warning', message: 'Baja un poco más' };
  },
  notVisibleMessage: 'Asegúrate de que tu cuerpo completo sea visible',
  calibrateDuringSet: true,
};

// ─────────────────────────────── Curl de bíceps ───────────────────────────────

export const CURL_3D: ExerciseDefinition3D = {
  id: 'curl',
  name: 'Curl de Bíceps',
  sides: 'either',
  sideLandmarks: { left: armSideLandmarks('left'), right: armSideLandmarks('right') },
  extraLandmarks: [],
  sideAngle: elbowAngle,
  combine: 'min',
  // Extendido > 160°, arriba < 60°; el brazo debe haber llegado a 130° antes de subir (DEC-017).
  cycle: { polarity: 'min', restDeg: 160, effortDeg: 60, confirmMarginDeg: CONFIRM_MARGIN_DEG, minStartDeg: 130 },
  perSideCycles: true,
  cooldownMs: ARM_COOLDOWN_MS,
  shape: { effortIsMinimum: true, concentricFirst: true },
  quality: { minRomDegrees: 50, minDurationMs: 700, maxDurationMs: 10000, minSmoothness: 0.3 },
  formCheck(ctx: FormContext) {
    // El balanceo invalida el estímulo del bíceps: se evalúa en todo el ciclo, por lado visible.
    for (const s of ['left', 'right'] as const) {
      if (!areVisible(ctx.world, armSideLandmarks(s), MIN_VISIBILITY)) continue;
      if (upperArmDrift(ctx.world, s) > CURL_MAX_ELBOW_DRIFT_DEG) {
        return { code: 'elbow_drift', level: 'bad', message: 'Pega el codo al cuerpo, estás usando impulso' };
      }
    }
    if (ctx.phase === 'effort' && ctx.asymmetry > ARM_MAX_ASYMMETRY) {
      return { code: 'asymmetry', level: 'warning', message: 'Un brazo va adelantado, iguala el recorrido' };
    }
    return null;
  },
  phaseFeedback(ctx: FormContext) {
    if (ctx.phase === 'rest') return { level: 'idle', message: 'Listo, sube el peso' };
    if (ctx.peakReached) {
      return ctx.extremeDeg <= GOOD_FORM_ANGLE
        ? { level: 'good', message: '¡Contracción completa! Baja controlado' }
        : { level: 'warning', message: 'Baja. En la próxima, sube un poco más' };
    }
    return ctx.primaryAngle <= GOOD_FORM_ANGLE
      ? { level: 'good', message: '¡Contracción completa!' }
      : { level: 'warning', message: 'Sube un poco más' };
  },
  notVisibleMessage: 'Asegúrate de que tu brazo sea visible',
  calibrateDuringSet: true,
};

// ─────────────────────────────── Press de hombro ───────────────────────────────

const HIPS = [LM.LEFT_HIP, LM.RIGHT_HIP] as const;

export const PRESS_3D: ExerciseDefinition3D = {
  id: 'press',
  name: 'Press de Hombro',
  sides: 'either',
  sideLandmarks: { left: armSideLandmarks('left'), right: armSideLandmarks('right') },
  extraLandmarks: [],
  sideAngle: elbowAngle,
  combine: 'max',
  // Abajo < 100°, arriba > 150°; polaridad invertida: el esfuerzo es el ángulo máximo (DEC-018).
  cycle: { polarity: 'max', restDeg: 100, effortDeg: 150, confirmMarginDeg: CONFIRM_MARGIN_DEG },
  perSideCycles: true,
  cooldownMs: ARM_COOLDOWN_MS,
  shape: { effortIsMinimum: false, concentricFirst: true },
  quality: { minRomDegrees: 45, minDurationMs: 700, maxDurationMs: 10000, minSmoothness: 0.3 },
  formCheck(ctx: FormContext) {
    // Arqueo lumbar: solo con la cadera visible (sin ella la inclinación sale de puntos
    // estimados) y con los brazos por encima del reposo, que es cuando hay carga arriba.
    // fitnetv2 lo evaluaba en todas las fases y sin exigir cadera (DEC-054).
    const armsUp = ctx.phase === 'effort' || ctx.primaryAngle > PRESS_3D.cycle.restDeg;
    if (armsUp && areVisible(ctx.world, HIPS, MIN_VISIBILITY) && torsoLean(ctx.world) > PRESS_MAX_TRUNK_LEAN_DEG) {
      return { code: 'lumbar_arch', level: 'bad', message: 'Aprieta el abdomen, estás arqueando la espalda' };
    }
    if (ctx.phase === 'rest' && ctx.primaryAngle > 0 && ctx.primaryAngle < SAFE_LOW_ANGLE) {
      return { code: 'unsafe_low_elbow', level: 'bad', message: 'No bajes tanto, cuida los hombros' };
    }
    if (ctx.phase === 'effort' && ctx.asymmetry > ARM_MAX_ASYMMETRY) {
      return { code: 'asymmetry', level: 'warning', message: 'Un brazo sube más que el otro' };
    }
    return null;
  },
  phaseFeedback(ctx: FormContext) {
    if (ctx.phase === 'rest') return { level: 'idle', message: 'Listo, empuja hacia arriba' };
    if (ctx.peakReached) {
      return ctx.extremeDeg >= GOOD_LOCKOUT_ANGLE
        ? { level: 'good', message: '¡Extensión completa! Baja controlado' }
        : { level: 'warning', message: 'Baja. En la próxima, extiende un poco más' };
    }
    return ctx.primaryAngle >= GOOD_LOCKOUT_ANGLE
      ? { level: 'good', message: '¡Extensión completa!' }
      : { level: 'warning', message: 'Extiende un poco más' };
  },
  notVisibleMessage: 'Asegúrate de que tus brazos sean visibles',
  calibrateDuringSet: false,
};

export const DEFINITIONS_3D = { squat: SQUAT_3D, curl: CURL_3D, press: PRESS_3D } as const;
export type Exercise3DId = keyof typeof DEFINITIONS_3D;
