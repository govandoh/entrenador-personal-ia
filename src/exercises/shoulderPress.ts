import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { calculateAngle } from '../geometry/angles';

const LM = {
  LEFT_SHOULDER:  11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW:     13,
  RIGHT_ELBOW:    14,
  LEFT_WRIST:     15,
  RIGHT_WRIST:    16,
} as const;

const PRESSED_ANGLE          = 150;  // > este valor → fase "pressed" (pesas overhead)
const LOWERED_ANGLE          = 100;  // < este valor → fase "lowered" (pesas a nivel de hombro)
// Confirmación de pico por frames consecutivos (ver DEC-016, DEC-017)
const FALLING_PER_FRAME      = 0.5;  // decremento mínimo por frame para contar como "bajando"
const MIN_FALLING_FRAMES     = 3;    // frames consecutivos de bajada para confirmar que se pasó el pico
export const GOOD_LOCKOUT_ANGLE = 145; // mínimo ángulo para "extensión completa" (evita hiperextensión a 180°)
export const SAFE_LOW_ANGLE     =  80; // < este valor → alerta roja (riesgo de impingement del supraespinoso)
// Cooldown post-rep: absorbe la señal del segundo brazo en press bilaterales (ver DEC-022 — mismo patrón que curl)
const REP_COOLDOWN_FRAMES    = 15;
const MIN_VISIBILITY         = 0.5;
const LATERAL_VIS_DIFF       = 0.35;  // diferencia de visibilidad para detectar vista lateral

export type PressPhase    = 'lowered' | 'pressed';
export type FeedbackLevel = 'idle' | 'good' | 'warning' | 'bad';

export interface ShoulderPressResult {
  phase:           PressPhase;
  reps:            number;
  feedbackLevel:   FeedbackLevel;
  feedbackMessage: string;
  elbowAngle:      number;
  /** true exactamente un frame cuando se detecta el pico del movimiento */
  atPeak:          boolean;
  /** ángulo máximo acumulado en la fase pressed actual (mayor = mejor extensión) */
  maxAngleReached: number;
  activeArm:       'left' | 'right' | 'both';
}

// Tracker de un solo brazo — polaridad inversa al curl (pico = ángulo MÁXIMO).
// No mantiene contador propio de reps; solo señaliza repCompleted.
// El contador vive en ShoulderPressTracker para unificar press bilaterales y alternos (ver DEC-022).
class ArmPressTracker {
  phase         : PressPhase = 'lowered';
  prevAngle       = 0;    // inicializa bajo porque el brazo empieza a nivel de hombro (~90°)
  maxAngleSeen    = 0;    // acumula el MÁXIMO (opuesto al minAngleSeen del curl)
  peakFired       = false;
  fallingFrames   = 0;

  update(angle: number): { repCompleted: boolean; atPeak: boolean; maxAngleReached: number; phase: PressPhase } {
    const prevPhase = this.phase;

    // Transiciones con histéresis: zona 100°–150° conserva la fase actual
    if      (angle > PRESSED_ANGLE)  this.phase = 'pressed';
    else if (angle < LOWERED_ANGLE)  this.phase = 'lowered';

    // Señalizar rep completada: solo si se confirmó el pico — no incrementa contador propio.
    // ShoulderPressTracker decide si contar según contexto bilateral/alterno (ver DEC-022).
    const repCompleted = prevPhase === 'pressed' && this.phase === 'lowered' && this.peakFired;

    // Detección de pico real por confirmación de frames consecutivos (ver DEC-016)
    // El pico es el MÁXIMO de ángulo → se confirma cuando el ángulo empieza a BAJAR
    let atPeak = false;
    if (this.phase === 'pressed') {
      if (angle > this.maxAngleSeen) this.maxAngleSeen = angle;
      // Solo se resetea fallingFrames si el ángulo sube claramente; los frames estables
      // (ruido de MediaPipe en el pico overhead) no deben interrumpir la confirmación.
      if (angle < this.prevAngle - FALLING_PER_FRAME) {
        this.fallingFrames++;
      } else if (angle > this.prevAngle + FALLING_PER_FRAME) {
        this.fallingFrames = 0;
      }
      if (!this.peakFired && this.fallingFrames >= MIN_FALLING_FRAMES) {
        atPeak = true;
        this.peakFired = true;
      }
    }

    const maxAngleReached = this.maxAngleSeen;

    // Resetear al volver al brazo en posición lowered
    if (this.phase === 'lowered' && prevPhase !== 'lowered') {
      this.peakFired     = false;
      this.maxAngleSeen  = 0;
      this.fallingFrames = 0;
    }

    this.prevAngle = angle;
    return { repCompleted, atPeak, maxAngleReached, phase: this.phase };
  }

  reset(): void {
    this.phase         = 'lowered';
    this.prevAngle     = 0;
    this.maxAngleSeen  = 0;
    this.peakFired     = false;
    this.fallingFrames = 0;
  }
}

export class ShoulderPressTracker {
  private left        = new ArmPressTracker();
  private right       = new ArmPressTracker();
  private reps        = 0;
  private repCooldown = 0;  // frames restantes de cooldown post-rep

  update(landmarks: NormalizedLandmark[]): ShoulderPressResult {
    // Visibilidad mínima del trío hombro-codo-muñeca por lado
    const leftVis  = Math.min(
      landmarks[LM.LEFT_SHOULDER]?.visibility  ?? 0,
      landmarks[LM.LEFT_ELBOW]?.visibility     ?? 0,
      landmarks[LM.LEFT_WRIST]?.visibility     ?? 0,
    );
    const rightVis = Math.min(
      landmarks[LM.RIGHT_SHOULDER]?.visibility ?? 0,
      landmarks[LM.RIGHT_ELBOW]?.visibility    ?? 0,
      landmarks[LM.RIGHT_WRIST]?.visibility    ?? 0,
    );

    // Vista lateral: un brazo supera al otro en más de LATERAL_VIS_DIFF
    const isLateral = Math.abs(leftVis - rightVis) > LATERAL_VIS_DIFF;
    const useLeft   = !isLateral || leftVis  >= rightVis;
    const useRight  = !isLateral || rightVis >  leftVis;

    const leftCanUse  = useLeft  && leftVis  >= MIN_VISIBILITY;
    const rightCanUse = useRight && rightVis >= MIN_VISIBILITY;

    if (!leftCanUse && !rightCanUse) {
      return {
        phase: 'lowered', reps: this.left.reps + this.right.reps,
        feedbackLevel: 'idle', feedbackMessage: 'Asegúrate de que tu brazo sea visible',
        elbowAngle: 0, atPeak: false, maxAngleReached: 0, activeArm: 'both',
      };
    }

    if (this.repCooldown > 0) this.repCooldown--;

    let leftRes   = null;
    let rightRes  = null;
    let leftAngle  = 0;
    let rightAngle = 0;

    if (leftCanUse) {
      leftAngle = calculateAngle(
        landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_ELBOW], landmarks[LM.LEFT_WRIST]
      );
      leftRes = this.left.update(leftAngle);
    }
    if (rightCanUse) {
      rightAngle = calculateAngle(
        landmarks[LM.RIGHT_SHOULDER], landmarks[LM.RIGHT_ELBOW], landmarks[LM.RIGHT_WRIST]
      );
      rightRes = this.right.update(rightAngle);
    }

    // OR logic: cualquier brazo que complete el ciclo dispara la rep.
    // El cooldown absorbe la señal del segundo brazo en press bilaterales (ver DEC-022).
    const eitherRepCompleted = (leftRes?.repCompleted ?? false) || (rightRes?.repCompleted ?? false);
    if (eitherRepCompleted && this.repCooldown === 0) {
      this.reps++;
      this.repCooldown = REP_COOLDOWN_FRAMES;
    }

    // Ángulo primario: el brazo más extendido (MÁXIMO — opuesto al curl que usa mínimo)
    const elbowAngle = leftCanUse && rightCanUse
      ? Math.max(leftAngle, rightAngle)
      : leftCanUse ? leftAngle : rightAngle;

    // Fase agregada: pressed si cualquier brazo está overhead
    const phase: PressPhase =
      leftRes?.phase === 'pressed' || rightRes?.phase === 'pressed' ? 'pressed' : 'lowered';

    // atPeak: cualquier brazo llegó al pico este frame
    const atPeak = (leftRes?.atPeak ?? false) || (rightRes?.atPeak ?? false);
    const maxAngleReached = atPeak
      ? Math.max(
          leftRes?.atPeak  ? leftRes.maxAngleReached  : 0,
          rightRes?.atPeak ? rightRes.maxAngleReached : 0,
        )
      : Math.max(leftRes?.maxAngleReached ?? 0, rightRes?.maxAngleReached ?? 0);

    const activeArm: ShoulderPressResult['activeArm'] = isLateral
      ? (leftCanUse ? 'left' : 'right')
      : 'both';

    return {
      phase,
      reps: this.reps,
      elbowAngle,
      atPeak,
      maxAngleReached,
      activeArm,
      ...this.buildFeedback(elbowAngle, phase),
    };
  }

  reset(): void {
    this.left.reset();
    this.right.reset();
    this.reps        = 0;
    this.repCooldown = 0;
  }

  private buildFeedback(
    elbowAngle: number,
    phase: PressPhase,
  ): Pick<ShoulderPressResult, 'feedbackLevel' | 'feedbackMessage'> {
    if (phase === 'pressed') {
      if (elbowAngle >= GOOD_LOCKOUT_ANGLE) {
        return { feedbackLevel: 'good',    feedbackMessage: '¡Extensión completa!' };
      }
      return   { feedbackLevel: 'warning', feedbackMessage: 'Extiende un poco más' };
    }
    // phase === 'lowered'
    if (elbowAngle < SAFE_LOW_ANGLE && elbowAngle > 0) {
      return   { feedbackLevel: 'bad',     feedbackMessage: 'No bajes tanto — cuida los hombros' };
    }
    return     { feedbackLevel: 'idle',    feedbackMessage: 'Listo — empuja hacia arriba' };
  }
}
