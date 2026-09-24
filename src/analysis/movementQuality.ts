/**
 * Calidad de movimiento: velocidad, tempo, suavidad y validación de repeticiones
 * (ver DEC-037 y DEC-045).
 *
 * Problema: contar una repetición cuando el ángulo cruza dos umbrales es un criterio
 * puramente posicional. No distingue una sentadilla real de un tirón, de un ajuste de
 * ropa o de un salto de landmarks: si el ángulo pasa por los valores correctos, cuenta.
 *
 * Aquí se agrega la dimensión temporal. Una repetición legítima tiene recorrido angular
 * mínimo, duración mínima y máxima y un recorrido continuo. Un artefacto no cumple todo
 * a la vez.
 *
 * Portado de fitnetv2 (`src/analysis/movementQuality.ts`, commit d456e95). Cambios: el
 * historial y la ventana de velocidad se miden en milisegundos en lugar de muestras, y
 * los mensajes para el usuario viven en `messages.ts`. Módulo puro: el tiempo llega del
 * `t` de cada frame.
 */

/** Una muestra de ángulo con su marca de tiempo. */
interface AngleSample {
  angle: number;
  timeMs: number;
}

/** Métricas de una repetición (METRICS.md §2). */
export interface RepMetrics {
  /** Recorrido angular total de la repetición, en grados. */
  romDegrees: number;
  /** Duración total, en ms. */
  durationMs: number;
  /** Duración de la fase de esfuerzo (concéntrica), en ms. */
  concentricMs: number;
  /** Duración de la fase de retorno (excéntrica), en ms. */
  eccentricMs: number;
  /** Velocidad media de la fase concéntrica, en °/s. */
  concentricVelocity: number;
  /** Velocidad máxima sobre ventanas de ~100 ms, en °/s. */
  peakVelocity: number;
  /** 0–1. Qué tan continuo fue el recorrido; 1 = perfectamente fluido. */
  smoothness: number;
  /** Instante en que se cerró la repetición, en ms. */
  completedAtMs: number;
}

export type RejectionReason = 'too_fast' | 'too_slow' | 'insufficient_rom' | 'erratic';

export interface ValidationResult {
  valid: boolean;
  reason?: RejectionReason;
  metrics: RepMetrics;
}

export interface QualityThresholds {
  /** Recorrido angular mínimo para aceptar la repetición, en grados. */
  minRomDegrees: number;
  /** Duración mínima, en ms. Por debajo, el movimiento es un tirón, no una repetición. */
  minDurationMs: number;
  /**
   * Duración mínima de la fase de esfuerzo, en ms. Atrapa el balanceo aunque el ciclo
   * completo dure lo suficiente (por ejemplo, dos tirones que se ven como un ciclo).
   */
  minConcentricMs: number;
  /** Duración máxima, en ms. Por encima, es una pausa o el usuario abandonó el movimiento. */
  maxDurationMs: number;
  /** Suavidad mínima, 0–1. Por debajo, el recorrido fue errático o hubo salto de landmarks. */
  minSmoothness: number;
}

/**
 * Valores por defecto, deliberadamente permisivos: es preferible dejar pasar alguna
 * repetición dudosa a rechazar las de un usuario que entrena lento o con pausa. Cada
 * ejercicio ajusta estos números a su cadencia natural.
 */
export const DEFAULT_THRESHOLDS: QualityThresholds = {
  minRomDegrees: 35,
  minDurationMs: 600,
  minConcentricMs: 250,
  maxDurationMs: 12000,
  // Con 0.35 se tolera un titubeo (3 inversiones); con 0.3, dos (5 inversiones).
  minSmoothness: 0.35,
};

/**
 * Estructura temporal de un ejercicio: dónde está el esfuerzo dentro del ciclo.
 *
 * - `effortIsMinimum`: el esfuerzo máximo es el ángulo MÍNIMO (fondo de sentadilla, cima
 *   del curl) o el MÁXIMO (bloqueo del press).
 * - `concentricFirst`: el ciclo empieza con la fase de esfuerzo (curl, press) o con la
 *   bajada (sentadilla).
 *
 * Sin estos dos datos no se sabe qué mitad es la concéntrica y la fatiga mide la fase
 * equivocada (DEC-045).
 */
export interface CycleShape {
  effortIsMinimum: boolean;
  concentricFirst: boolean;
}

/**
 * Retroceso mínimo, en grados, para contar un cambio de dirección. El temblor produce
 * oscilaciones de 2 a 6° cuadro a cuadro; con histéresis solo cuenta un cambio cuando el
 * ángulo retrocede más que este margen desde el último extremo (DEC-045).
 */
const REVERSAL_THRESHOLD_DEG = 12;

/** Distancia al extremo de reposo, en grados, dentro de la cual el usuario aún no se mueve. */
const REST_BAND_DEG = 6;

/** Historial que se conserva, en ms: suficiente para una repetición lenta. */
const MAX_HISTORY_MS = 20000;

/** Ventana de la velocidad pico, en ms: la derivada cuadro a cuadro está dominada por el ruido. */
const PEAK_VELOCITY_WINDOW_MS = 100;

/** Ventana por defecto de `currentVelocity`, en ms. */
const CURRENT_VELOCITY_WINDOW_MS = 100;

/**
 * Acumula muestras de ángulo y evalúa si un ciclo completo merece contarse.
 *
 * El tracker entrega cada cuadro con `addSample`, marca con `markCycleBoundary` cada
 * vuelta a la posición de reposo y, cuando su máquina de estados cree haber cerrado un
 * ciclo, llama a `validateRep` para decidir si era real.
 */
export class MovementAnalyzer {
  private samples: AngleSample[] = [];
  /** Índice dentro de `samples` de la última vuelta a la posición de reposo. */
  private boundaryIndex = 0;
  private thresholds: QualityThresholds;

  constructor(thresholds: Partial<QualityThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  addSample(angle: number, timeMs: number): void {
    this.samples.push({ angle, timeMs });

    // Se recorta por tiempo, no por número de muestras, para que el horizonte no dependa de los fps.
    let removed = 0;
    while (removed < this.samples.length - 1 && timeMs - this.samples[removed].timeMs > MAX_HISTORY_MS) {
      removed++;
    }
    if (removed > 0) {
      this.samples.splice(0, removed);
      // El índice se desplaza con el recorte para seguir apuntando al mismo cuadro.
      this.boundaryIndex = Math.max(0, this.boundaryIndex - removed);
    }
  }

  /**
   * Marca el cuadro actual como vuelta a la posición de reposo. La pausa en reposo antes
   * de moverse se recorta en `validateRep`, así que marcar temprano no infla la duración.
   */
  markCycleBoundary(): void {
    this.boundaryIndex = Math.max(0, this.samples.length - 1);
  }

  /** Velocidad angular reciente en °/s, promediada sobre `windowMs` hacia atrás. */
  currentVelocity(windowMs = CURRENT_VELOCITY_WINDOW_MS): number {
    const n = this.samples.length;
    if (n < 2) return 0;

    const last = this.samples[n - 1];
    let start = n - 2;
    while (start > 0 && last.timeMs - this.samples[start - 1].timeMs <= windowMs) start--;
    const first = this.samples[start];

    const dt = last.timeMs - first.timeMs;
    if (dt <= 0) return 0;
    return ((last.angle - first.angle) / dt) * 1000;
  }

  /** Evalúa el ciclo en curso y decide si es una repetición legítima. */
  validateRep(shape: CycleShape): ValidationResult {
    const window = trimToMovement(this.samples.slice(this.boundaryIndex), shape);
    const metrics = computeMetrics(window, shape);
    const th = this.thresholds;

    if (metrics.romDegrees < th.minRomDegrees)     return { valid: false, reason: 'insufficient_rom', metrics };
    if (metrics.durationMs < th.minDurationMs)     return { valid: false, reason: 'too_fast', metrics };
    if (metrics.concentricMs < th.minConcentricMs) return { valid: false, reason: 'too_fast', metrics };
    if (metrics.durationMs > th.maxDurationMs)     return { valid: false, reason: 'too_slow', metrics };
    if (metrics.smoothness < th.minSmoothness)     return { valid: false, reason: 'erratic', metrics };

    return { valid: true, metrics };
  }

  reset(): void {
    this.samples = [];
    this.boundaryIndex = 0;
  }
}

/**
 * Recorta la pausa en reposo al inicio de la ventana: el movimiento real empieza en el
 * último cuadro, antes del punto de esfuerzo, en que el ángulo seguía en la banda de reposo.
 */
function trimToMovement(window: AngleSample[], shape: CycleShape): AngleSample[] {
  if (window.length < 3) return window;

  const effortIndex = findEffortIndex(window, shape.effortIsMinimum);

  // El reposo es el extremo opuesto al esfuerzo, buscado antes de este.
  let restAngle = window[0].angle;
  for (let i = 0; i <= effortIndex; i++) {
    const a = window[i].angle;
    if (shape.effortIsMinimum ? a > restAngle : a < restAngle) restAngle = a;
  }

  let start = 0;
  for (let i = effortIndex; i >= 0; i--) {
    if (Math.abs(window[i].angle - restAngle) <= REST_BAND_DEG) {
      start = i;
      break;
    }
  }
  return window.slice(start);
}

function findEffortIndex(window: AngleSample[], effortIsMinimum: boolean): number {
  let index = 0;
  let value = window[0].angle;
  for (let i = 1; i < window.length; i++) {
    const a = window[i].angle;
    if (effortIsMinimum ? a < value : a > value) {
      value = a;
      index = i;
    }
  }
  return index;
}

function computeMetrics(window: AngleSample[], shape: CycleShape): RepMetrics {
  if (window.length < 3) {
    return {
      romDegrees: 0, durationMs: 0, concentricMs: 0, eccentricMs: 0,
      concentricVelocity: 0, peakVelocity: 0, smoothness: 0, completedAtMs: 0,
    };
  }

  const first = window[0];
  const last  = window[window.length - 1];
  const durationMs = last.timeMs - first.timeMs;
  const effort = window[findEffortIndex(window, shape.effortIsMinimum)];

  let minAngle = Infinity;
  let maxAngle = -Infinity;
  for (const s of window) {
    if (s.angle < minAngle) minAngle = s.angle;
    if (s.angle > maxAngle) maxAngle = s.angle;
  }

  // El punto de esfuerzo parte el ciclo en sus dos fases; cuál es la concéntrica depende
  // del ejercicio: en el curl es la primera mitad, en la sentadilla la segunda.
  const firstHalfMs  = effort.timeMs - first.timeMs;
  const secondHalfMs = last.timeMs - effort.timeMs;
  const concentricMs = shape.concentricFirst ? firstHalfMs : secondHalfMs;
  const eccentricMs  = shape.concentricFirst ? secondHalfMs : firstHalfMs;

  const concentricTravel = shape.concentricFirst
    ? Math.abs(effort.angle - first.angle)
    : Math.abs(last.angle - effort.angle);
  const concentricVelocity = concentricMs > 0 ? concentricTravel / (concentricMs / 1000) : 0;

  let peakVelocity = 0;
  let j = 0;
  for (let i = 1; i < window.length; i++) {
    while (window[i].timeMs - window[j].timeMs > PEAK_VELOCITY_WINDOW_MS) j++;
    const dt = window[i].timeMs - window[j].timeMs;
    if (dt <= 0) continue;
    const v = Math.abs(window[i].angle - window[j].angle) / (dt / 1000);
    if (v > peakVelocity) peakVelocity = v;
  }

  return {
    romDegrees: maxAngle - minAngle,
    durationMs,
    concentricMs,
    eccentricMs,
    concentricVelocity,
    peakVelocity,
    smoothness: computeSmoothness(window),
    completedAtMs: last.timeMs,
  };
}

/**
 * Suavidad 0–1 a partir de los cambios de dirección reales. Una repetición tiene uno (el
 * punto de esfuerzo); cada titubeo agrega dos. Cada inversión de más resta 1/6.
 */
function computeSmoothness(window: AngleSample[]): number {
  const reversals = countReversals(window.map(s => s.angle), REVERSAL_THRESHOLD_DEG);
  const excess = Math.max(0, reversals - 1);
  return Math.max(0, 1 - excess / 6);
}

/**
 * Cuenta cambios de dirección con histéresis: solo cuenta cuando el ángulo retrocede más
 * de `threshold` grados desde el último extremo alcanzado.
 */
export function countReversals(angles: readonly number[], threshold: number): number {
  if (angles.length < 2) return 0;

  let direction = 0; // 0 = sin dirección aún, 1 = subiendo, -1 = bajando
  let extreme = angles[0];
  let lowSinceStart = angles[0];
  let highSinceStart = angles[0];
  let reversals = 0;

  for (const a of angles) {
    if (direction === 0) {
      if (a < lowSinceStart) lowSinceStart = a;
      if (a > highSinceStart) highSinceStart = a;
      if (a - lowSinceStart >= threshold) { direction = 1; extreme = a; }
      else if (highSinceStart - a >= threshold) { direction = -1; extreme = a; }
    } else if (direction === 1) {
      if (a > extreme) extreme = a;
      else if (extreme - a >= threshold) { direction = -1; extreme = a; reversals++; }
    } else {
      if (a < extreme) extreme = a;
      else if (a - extreme >= threshold) { direction = 1; extreme = a; reversals++; }
    }
  }
  return reversals;
}
