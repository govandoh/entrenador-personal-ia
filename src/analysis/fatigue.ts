import type { RepMetrics } from './movementQuality.ts';

/**
 * Detección de fatiga por degradación del patrón de movimiento (ver DEC-038).
 *
 * Fundamento: en entrenamiento de fuerza, la velocidad concéntrica cae de forma monótona
 * conforme se acumula fatiga dentro de una serie, aun con la carga constante (principio
 * del entrenamiento basado en velocidad, METRICS.md §3). Junto con la pérdida de
 * recorrido y el aumento de asimetría da una estimación sin sensores adicionales.
 *
 * NO es un diagnóstico médico: es un indicador para sugerir descanso.
 *
 * Portado de fitnetv2 (`src/analysis/fatigue.ts`, commit d456e95). Cambios: el estado ya
 * no lleva el texto ni el color (la UI los resuelve desde `level`, ver `messages.ts`).
 *
 * Pendiente del paso I-2 (DEC-054): los trackers de v2 pasan la asimetría del cuadro que
 * cierra la repetición, que en reposo es ≈ 0; deben pasar la del punto de esfuerzo.
 */

export type FatigueLevel = 'fresh' | 'moderate' | 'high' | 'critical';

export interface FatigueState {
  level: FatigueLevel;
  /** 0–100. Combina caída de velocidad, pérdida de recorrido y asimetría. */
  score: number;
  /** Caída porcentual de velocidad concéntrica respecto a la línea base. */
  velocityDropPercent: number;
  /** Pérdida porcentual de recorrido respecto a la línea base. */
  romLossPercent: number;
  /** true cuando conviene cortar la serie. */
  shouldRest: boolean;
}

/** Repeticiones iniciales que definen la línea base de la serie. */
const BASELINE_REPS = 3;
/** Repeticiones recientes que se promedian contra la línea base. */
const RECENT_REPS = 3;

/** Umbrales de caída de velocidad, en % sobre la línea base (20 % ≈ mitad de reps hasta el fallo). */
const VELOCITY_MODERATE_PCT = 10;
const VELOCITY_HIGH_PCT     = 20;
const VELOCITY_CRITICAL_PCT = 30;

/** Umbrales del puntaje combinado, 0–100. */
const SCORE_MODERATE = 22;
const SCORE_HIGH     = 45;
const SCORE_CRITICAL = 70;

/** Pesos del puntaje: la velocidad es el indicador principal; recorrido y asimetría lo corrigen. */
const WEIGHT_VELOCITY  = 2;
const WEIGHT_ROM       = 1.5;
const WEIGHT_ASYMMETRY = 40;

/** Peso de la historia en la media móvil de asimetría. */
const ASYMMETRY_DECAY = 0.7;

export const FRESH_FATIGUE: FatigueState = {
  level: 'fresh', score: 0, velocityDropPercent: 0, romLossPercent: 0, shouldRest: false,
};

/**
 * Acumula las repeticiones de una serie y estima el nivel de fatiga.
 * Se reinicia con `reset` al empezar cada serie.
 */
export class FatigueDetector {
  private reps: RepMetrics[] = [];
  private baselineVelocity = 0;
  private baselineRom = 0;
  private recentAsymmetry = 0;

  /** Registra una repetición validada y devuelve el estado actualizado. */
  addRep(metrics: RepMetrics, asymmetry = 0): FatigueState {
    this.reps.push(metrics);
    // Media móvil: una repetición aislada con un landmark ruidoso no dispara la alarma.
    this.recentAsymmetry = this.recentAsymmetry * ASYMMETRY_DECAY + asymmetry * (1 - ASYMMETRY_DECAY);

    if (this.reps.length === BASELINE_REPS) this.computeBaseline();
    return this.evaluate();
  }

  getState(): FatigueState {
    return this.evaluate();
  }

  reset(): void {
    this.reps = [];
    this.baselineVelocity = 0;
    this.baselineRom = 0;
    this.recentAsymmetry = 0;
  }

  get repCount(): number {
    return this.reps.length;
  }

  private computeBaseline(): void {
    const base = this.reps.slice(0, BASELINE_REPS);
    this.baselineVelocity = mean(base.map(r => r.concentricVelocity));
    this.baselineRom = mean(base.map(r => r.romDegrees));
  }

  private evaluate(): FatigueState {
    if (this.reps.length < BASELINE_REPS || this.baselineVelocity <= 0) return FRESH_FATIGUE;

    // Se comparan las últimas repeticiones, no solo la última, para no saltar de nivel por ruido.
    const recent = this.reps.slice(-RECENT_REPS);
    const recentVelocity = mean(recent.map(r => r.concentricVelocity));
    const recentRom = mean(recent.map(r => r.romDegrees));

    const velocityDropPercent = Math.max(
      0, ((this.baselineVelocity - recentVelocity) / this.baselineVelocity) * 100,
    );
    const romLossPercent = this.baselineRom > 0
      ? Math.max(0, ((this.baselineRom - recentRom) / this.baselineRom) * 100)
      : 0;

    const score = Math.min(100,
      velocityDropPercent * WEIGHT_VELOCITY +
      romLossPercent * WEIGHT_ROM +
      this.recentAsymmetry * WEIGHT_ASYMMETRY,
    );

    let level: FatigueLevel = 'fresh';
    if (velocityDropPercent >= VELOCITY_CRITICAL_PCT || score >= SCORE_CRITICAL)      level = 'critical';
    else if (velocityDropPercent >= VELOCITY_HIGH_PCT || score >= SCORE_HIGH)         level = 'high';
    else if (velocityDropPercent >= VELOCITY_MODERATE_PCT || score >= SCORE_MODERATE) level = 'moderate';

    return {
      level,
      score: Math.round(score),
      velocityDropPercent: Math.round(velocityDropPercent),
      romLossPercent: Math.round(romLossPercent),
      shouldRest: level === 'critical',
    };
  }
}

function mean(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}
