import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { calculateAngle } from '../geometry/angles';

const LM = {
  LEFT_HIP:    23,
  RIGHT_HIP:   24,
  LEFT_KNEE:   25,
  RIGHT_KNEE:  26,
  LEFT_ANKLE:  27,
  RIGHT_ANKLE: 28,
} as const;

const STANDING_ANGLE   = 160; // > este valor → fase "standing"
const BOTTOM_ANGLE     = 100; // < este valor → fase "squatting"
export const GOOD_DEPTH_ANGLE = 90; // < este valor → profundidad óptima (paralelo o más)
const RISING_THRESHOLD =   2; // grados de subida para confirmar que se pasó el fondo
const MIN_VISIBILITY   = 0.5;

export type SquatPhase    = 'standing' | 'squatting' | 'transition';
export type FeedbackLevel = 'idle' | 'good' | 'warning' | 'bad';

export interface SquatResult {
  phase:           SquatPhase;
  reps:            number;
  feedbackLevel:   FeedbackLevel;
  feedbackMessage: string;
  kneeAngle:       number;
  /** true exactamente un frame cuando se detecta el punto más bajo del movimiento */
  atBottom:        boolean;
  /** ángulo mínimo acumulado desde que entró a la fase squatting */
  minAngleReached: number;
}

export class SquatTracker {
  private phase:         SquatPhase = 'standing';
  private reps           = 0;
  private prevKneeAngle  = 180; // ángulo del frame anterior (para detectar giro de subida)
  private minAngleSeen   = 180; // mínimo acumulado en la bajada actual
  private bottomFired    = false; // garantiza que el evento dispare solo una vez por rep

  update(landmarks: NormalizedLandmark[]): SquatResult {
    const keyIndices = [
      LM.LEFT_HIP,  LM.RIGHT_HIP,
      LM.LEFT_KNEE, LM.RIGHT_KNEE,
      LM.LEFT_ANKLE, LM.RIGHT_ANKLE,
    ];

    const allVisible = keyIndices.every(
      i => (landmarks[i]?.visibility ?? 0) >= MIN_VISIBILITY
    );
    if (!allVisible) {
      return {
        phase: this.phase, reps: this.reps,
        feedbackLevel: 'idle',
        feedbackMessage: 'Asegúrate de que tu cuerpo completo sea visible',
        kneeAngle: 0, atBottom: false, minAngleReached: this.minAngleSeen,
      };
    }

    const leftAngle  = calculateAngle(landmarks[LM.LEFT_HIP],  landmarks[LM.LEFT_KNEE],  landmarks[LM.LEFT_ANKLE]);
    const rightAngle = calculateAngle(landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_KNEE], landmarks[LM.RIGHT_ANKLE]);
    const kneeAngle  = (leftAngle + rightAngle) / 2;

    const prevPhase = this.phase;

    // ── Transiciones de fase con histéresis ──
    if (kneeAngle > STANDING_ANGLE) {
      this.phase = 'standing';
    } else if (kneeAngle < BOTTOM_ANGLE) {
      this.phase = 'squatting';
    }
    // else: zona 100–160°, la fase se mantiene

    // Contar rep al completar el ciclo squatting → standing
    if (prevPhase === 'squatting' && this.phase === 'standing') {
      this.reps++;
    }

    // ── Detección del fondo real ──
    let atBottom = false;

    if (this.phase === 'squatting') {
      // Acumular el ángulo mínimo visto en esta bajada
      if (kneeAngle < this.minAngleSeen) {
        this.minAngleSeen = kneeAngle;
      }
      // El fondo se confirma cuando el ángulo sube más de RISING_THRESHOLD
      // respecto al frame anterior → el usuario ya está en la fase ascendente
      if (!this.bottomFired && kneeAngle > this.prevKneeAngle + RISING_THRESHOLD) {
        atBottom = true;
        this.bottomFired = true;
      }
    }

    // Capturar el mínimo antes de resetearlo
    const minAngleReached = this.minAngleSeen;

    // Resetear el tracking del fondo al volver a standing
    if (this.phase === 'standing' && prevPhase !== 'standing') {
      this.bottomFired  = false;
      this.minAngleSeen = 180;
    }

    this.prevKneeAngle = kneeAngle;

    return {
      phase: this.phase,
      reps:  this.reps,
      kneeAngle,
      atBottom,
      minAngleReached,
      ...this.buildFeedback(kneeAngle),
    };
  }

  reset(): void {
    this.phase         = 'standing';
    this.reps          = 0;
    this.prevKneeAngle = 180;
    this.minAngleSeen  = 180;
    this.bottomFired   = false;
  }

  private buildFeedback(kneeAngle: number): Pick<SquatResult, 'feedbackLevel' | 'feedbackMessage'> {
    if (this.phase === 'squatting') {
      if (kneeAngle <= GOOD_DEPTH_ANGLE) {
        return { feedbackLevel: 'good',    feedbackMessage: '¡Excelente profundidad!' };
      }
      return   { feedbackLevel: 'warning', feedbackMessage: 'Baja un poco más' };
    }
    if (this.phase === 'standing') {
      return   { feedbackLevel: 'idle',    feedbackMessage: 'Listo — baja para la sentadilla' };
    }
    return     { feedbackLevel: 'idle',    feedbackMessage: '' };
  }
}
