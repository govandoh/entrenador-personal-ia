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

const EXTENDED_ANGLE         = 160;  // > este valor → brazo extendido (abajo)
const FLEXED_ANGLE           = 60;   // < este valor → brazo en cima del curl
export const GOOD_FORM_ANGLE = 50;   // < este valor → contracción completa
// Confirmación de cima por frames consecutivos (ver DEC-016)
const RISING_PER_FRAME       = 0.5;  // incremento mínimo por frame para contar como "subiendo"
const MIN_RISING_FRAMES      = 3;    // frames consecutivos de subida para confirmar que se pasó la cima
const MIN_VISIBILITY         = 0.5;
const LATERAL_VIS_DIFF       = 0.35; // diferencia de visibilidad para detectar vista lateral

export type CurlPhase    = 'extended' | 'flexed';
export type FeedbackLevel = 'idle' | 'good' | 'warning' | 'bad';

export interface BicepCurlResult {
  phase:           CurlPhase;
  reps:            number;
  feedbackLevel:   FeedbackLevel;
  feedbackMessage: string;
  elbowAngle:      number;
  /** true exactamente un frame cuando se detecta la cima del movimiento */
  atTop:           boolean;
  /** ángulo mínimo acumulado en la fase flexed (menor = mejor contracción) */
  minAngleReached: number;
  activeArm:       'left' | 'right' | 'both';
}

// Tracker de un solo brazo — maneja su propia máquina de estados
class ArmTracker {
  phase        : CurlPhase = 'extended';
  reps           = 0;
  prevAngle      = 180;
  minAngleSeen   = 180;
  topFired       = false;
  risingFrames   = 0;

  update(angle: number): { atTop: boolean; minAngleReached: number; phase: CurlPhase } {
    const prevPhase = this.phase;

    // Transiciones con histéresis: zona 60–160° conserva la fase actual
    if      (angle > EXTENDED_ANGLE) this.phase = 'extended';
    else if (angle < FLEXED_ANGLE)   this.phase = 'flexed';

    // Rep completada: solo si se confirmó la cima (topFired) — previene reps falsas por movimientos bruscos (ver DEC-017)
    if (prevPhase === 'flexed' && this.phase === 'extended' && this.topFired) this.reps++;

    // Detección de cima real por confirmación de frames consecutivos (ver DEC-016)
    let atTop = false;
    if (this.phase === 'flexed') {
      if (angle < this.minAngleSeen) this.minAngleSeen = angle;
      if (angle > this.prevAngle + RISING_PER_FRAME) {
        this.risingFrames++;
      } else {
        this.risingFrames = 0;
      }
      if (!this.topFired && this.risingFrames >= MIN_RISING_FRAMES) {
        atTop = true;
        this.topFired = true;
      }
    }

    const minAngleReached = this.minAngleSeen;

    // Resetear al volver al brazo extendido
    if (this.phase === 'extended' && prevPhase !== 'extended') {
      this.topFired     = false;
      this.minAngleSeen = 180;
      this.risingFrames = 0;
    }

    this.prevAngle = angle;
    return { atTop, minAngleReached, phase: this.phase };
  }

  reset(): void {
    this.phase        = 'extended';
    this.reps         = 0;
    this.prevAngle    = 180;
    this.minAngleSeen = 180;
    this.topFired     = false;
    this.risingFrames = 0;
  }
}

export class BicepCurlTracker {
  private left  = new ArmTracker();
  private right = new ArmTracker();

  update(landmarks: NormalizedLandmark[]): BicepCurlResult {
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
        phase: 'extended', reps: this.left.reps + this.right.reps,
        feedbackLevel: 'idle', feedbackMessage: 'Asegúrate de que tu brazo sea visible',
        elbowAngle: 0, atTop: false, minAngleReached: 180, activeArm: 'both',
      };
    }

    let leftRes  = null;
    let rightRes = null;
    let leftAngle  = 180;
    let rightAngle = 180;

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

    // Ángulo primario: el brazo más activo (menor ángulo = más contraído)
    const elbowAngle = leftCanUse && rightCanUse
      ? Math.min(leftAngle, rightAngle)
      : leftCanUse ? leftAngle : rightAngle;

    // Fase agregada: flexed si cualquier brazo está contraído
    const phase: CurlPhase =
      leftRes?.phase === 'flexed' || rightRes?.phase === 'flexed' ? 'flexed' : 'extended';

    // atTop: cualquier brazo llegó a la cima este frame
    const atTop = (leftRes?.atTop ?? false) || (rightRes?.atTop ?? false);
    const minAngleReached = atTop
      ? Math.min(
          leftRes?.atTop  ? leftRes.minAngleReached  : 180,
          rightRes?.atTop ? rightRes.minAngleReached : 180,
        )
      : Math.min(leftRes?.minAngleReached ?? 180, rightRes?.minAngleReached ?? 180);

    const activeArm: BicepCurlResult['activeArm'] = isLateral
      ? (leftCanUse ? 'left' : 'right')
      : 'both';

    return {
      phase,
      reps: this.left.reps + this.right.reps,
      elbowAngle,
      atTop,
      minAngleReached,
      activeArm,
      ...this.buildFeedback(elbowAngle, phase),
    };
  }

  reset(): void {
    this.left.reset();
    this.right.reset();
  }

  private buildFeedback(
    elbowAngle: number,
    phase: CurlPhase,
  ): Pick<BicepCurlResult, 'feedbackLevel' | 'feedbackMessage'> {
    if (phase === 'flexed') {
      if (elbowAngle <= GOOD_FORM_ANGLE) {
        return { feedbackLevel: 'good',    feedbackMessage: '¡Contracción completa!' };
      }
      return   { feedbackLevel: 'warning', feedbackMessage: 'Sube un poco más' };
    }
    return     { feedbackLevel: 'idle',    feedbackMessage: 'Listo — sube el peso' };
  }
}
