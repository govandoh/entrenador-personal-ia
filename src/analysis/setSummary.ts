import type { FeedbackLevel, Tracker3DResult } from '../exercises/tracker3d.ts';
import { FRESH_FATIGUE, type FatigueState } from './fatigue.ts';
import type { RejectionReason } from './movementQuality.ts';

/**
 * Resumen de una serie para la pantalla de resumen y el historial (workstream B, puro).
 *
 * Se alimenta frame a frame con la salida del contador 3D (`addFrame`) o, en el motor 2D,
 * repetición a repetición (`addRep2D`). La calidad de cada repetición es el nivel de aviso
 * que había en el pico o fondo confirmado: es lo que la voz dijo en ese momento (DEC-016).
 */

export type RepQuality = 'good' | 'warning' | 'bad';

export interface RepSummary {
  quality: RepQuality;
  /** Duración de la fase de esfuerzo, en ms (null en el motor 2D). */
  concentricMs: number | null;
  /** Velocidad media de la fase de esfuerzo, en °/s (null en el motor 2D). */
  concentricVelocity: number | null;
}

export interface SetSummary {
  reps: RepSummary[];
  validReps: number;
  goodReps: number;
  rejected: Partial<Record<RejectionReason, number>>;
  rejectedReps: number;
  /** Veces que apareció cada problema de forma en un pico, por código (`trunk_lean`…). */
  formIssues: Record<string, number>;
  fatigue: FatigueState;
  /** Caída de velocidad entre las primeras y las últimas repeticiones, en %, o null si hay menos de 4. */
  velocityDropPercent: number | null;
}

/** Etiquetas en español de los códigos de forma de `definitions3d.ts` (docs/METRICS.md). */
export const FORM_ISSUE_LABELS: Record<string, string> = {
  trunk_lean: 'Tronco muy inclinado',
  asymmetry: 'Lados desparejos',
  elbow_drift: 'Codo separado del cuerpo',
  lumbar_arch: 'Espalda arqueada',
  unsafe_low_elbow: 'Codos demasiado abajo',
  hip_sag: 'Cadera caída',
  hip_pike: 'Cadera muy alta',
};

function toQuality(level: FeedbackLevel): RepQuality {
  return level === 'bad' ? 'bad' : level === 'warning' ? 'warning' : 'good';
}

/** Repeticiones que se promedian al principio y al final para la caída de velocidad. */
const VELOCITY_WINDOW_REPS = 3;

export class SetSummaryBuilder {
  private readonly reps: RepSummary[] = [];
  private readonly rejected: Partial<Record<RejectionReason, number>> = {};
  private readonly formIssues: Record<string, number> = {};
  private pendingQuality: RepQuality | null = null;
  private fatigue: FatigueState = FRESH_FATIGUE;

  /** Motor 3D: un frame del contador. */
  addFrame(r: Tracker3DResult): void {
    if (r.peak) {
      this.pendingQuality = toQuality(r.feedbackLevel);
      if (r.formIssue) this.formIssues[r.formIssue] = (this.formIssues[r.formIssue] ?? 0) + 1;
    }
    if (r.rejection) {
      this.rejected[r.rejection] = (this.rejected[r.rejection] ?? 0) + 1;
      this.pendingQuality = null;
    }
    if (r.repCounted) {
      this.reps.push({
        quality: this.pendingQuality ?? 'good',
        concentricMs: r.lastRepMetrics?.concentricMs ?? null,
        concentricVelocity: r.lastRepMetrics?.concentricVelocity ?? null,
      });
      this.pendingQuality = null;
    }
    this.fatigue = r.fatigue;
  }

  /** Repeticiones válidas de la serie hasta ahora (barato: se lee por cuadro). */
  get validReps(): number {
    return this.reps.length;
  }

  /** Motor 2D: una repetición contada con el nivel de aviso de su pico. */
  addRep2D(level: FeedbackLevel): void {
    this.reps.push({ quality: toQuality(level), concentricMs: null, concentricVelocity: null });
  }

  summary(): SetSummary {
    const rejectedReps = Object.values(this.rejected).reduce((s, n) => s + (n ?? 0), 0);
    return {
      reps: [...this.reps],
      validReps: this.reps.length,
      goodReps: this.reps.filter(r => r.quality === 'good').length,
      rejected: { ...this.rejected },
      rejectedReps,
      formIssues: { ...this.formIssues },
      fatigue: this.fatigue,
      velocityDropPercent: velocityDrop(this.reps),
    };
  }
}

function velocityDrop(reps: readonly RepSummary[]): number | null {
  const v = reps.map(r => r.concentricVelocity).filter((x): x is number => x !== null && x > 0);
  if (v.length < VELOCITY_WINDOW_REPS + 1) return null;
  const k = Math.min(VELOCITY_WINDOW_REPS, Math.floor(v.length / 2));
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const first = mean(v.slice(0, k));
  const last = mean(v.slice(-k));
  return first > 0 ? Math.max(0, Math.round(((first - last) / first) * 100)) : null;
}
