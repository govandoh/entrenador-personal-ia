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
const RISING_PER_FRAME       = 0.5;  // delta mínimo para contar frame como "subiendo" o "bajando"
const MIN_RISING_FRAMES      = 3;    // frames consecutivos de subida para confirmar que se pasó la cima
// Validación de rango de movimiento: el brazo debe haber estado a ≥ este ángulo
// antes del curl para que la rep cuente (evita falsas reps por movimientos parciales o de ajuste)
const MIN_START_ANGLE        = 130;
// Cooldown post-rep: bloquea el segundo brazo en curls bilaterales (~15 frames ≈ 250 ms a 60 fps)
// sin bloquear curls alternos donde el segundo brazo dispara >500 ms después (ver DEC-022)
const REP_COOLDOWN_FRAMES    = 15;
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

// Tracker de un solo brazo — señaliza eventos sin mantener contador de reps propio.
// El contador vive en BicepCurlTracker para unificar curls bilaterales y alternos (ver DEC-022).
class ArmTracker {
  phase            : CurlPhase = 'extended';
  prevAngle          = 180;
  minAngleSeen       = 180;
  maxAngleSeen       = 0;   // máximo ángulo mientras está en 'extended' (valida el inicio del recorrido)
  maxAngleBeforeCurl = 0;   // capturado al entrar a 'flexed'; gate de rango de movimiento mínimo
  topFired           = false;
  risingFrames       = 0;

  update(angle: number): { repCompleted: boolean; atTop: boolean; minAngleReached: number; phase: CurlPhase } {
    const prevPhase = this.phase;

    // Transiciones con histéresis: zona 60–160° conserva la fase actual
    if      (angle > EXTENDED_ANGLE) this.phase = 'extended';
    else if (angle < FLEXED_ANGLE)   this.phase = 'flexed';

    // Acumular máximo ángulo durante la fase 'extended' (recorrido de inicio)
    if (this.phase === 'extended') {
      if (angle > this.maxAngleSeen) this.maxAngleSeen = angle;
    }

    // Capturar el máximo del tramo extendido justo al entrar a 'flexed'
    if (this.phase === 'flexed' && prevPhase !== 'flexed') {
      this.maxAngleBeforeCurl = this.maxAngleSeen;
    }

    // Señalizar rep completada: (1) cima confirmada y (2) brazo partió de ≥ MIN_START_ANGLE.
    // No incrementa contador propio — BicepCurlTracker decide si contar según el contexto
    // bilateral/alterno (ver DEC-022).
    const repCompleted = prevPhase === 'flexed' && this.phase === 'extended'
      && this.topFired && this.maxAngleBeforeCurl >= MIN_START_ANGLE;

    // Detección de cima real por confirmación de frames consecutivos (ver DEC-016)
    let atTop = false;
    if (this.phase === 'flexed') {
      if (angle < this.minAngleSeen) this.minAngleSeen = angle;
      // Solo resetear risingFrames si el ángulo baja claramente; frames estables por ruido
      // de MediaPipe en la cima no deben interrumpir la confirmación.
      if (angle > this.prevAngle + RISING_PER_FRAME) {
        this.risingFrames++;
      } else if (angle < this.prevAngle - RISING_PER_FRAME) {
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
      this.topFired          = false;
      this.minAngleSeen      = 180;
      this.risingFrames      = 0;
      this.maxAngleSeen      = 0;
      this.maxAngleBeforeCurl = 0;
    }

    this.prevAngle = angle;
    return { repCompleted, atTop, minAngleReached, phase: this.phase };
  }

  reset(): void {
    this.phase             = 'extended';
    this.prevAngle         = 180;
    this.minAngleSeen      = 180;
    this.maxAngleSeen      = 0;
    this.maxAngleBeforeCurl = 0;
    this.topFired          = false;
    this.risingFrames      = 0;
  }
}

export class BicepCurlTracker {
  private left        = new ArmTracker();
  private right       = new ArmTracker();
  private reps        = 0;
  private repCooldown = 0;  // frames restantes de cooldown post-rep

  update(landmarks: NormalizedLandmark[]): BicepCurlResult {
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

    const isLateral = Math.abs(leftVis - rightVis) > LATERAL_VIS_DIFF;
    const useLeft   = !isLateral || leftVis  >= rightVis;
    const useRight  = !isLateral || rightVis >  leftVis;

    const leftCanUse  = useLeft  && leftVis  >= MIN_VISIBILITY;
    const rightCanUse = useRight && rightVis >= MIN_VISIBILITY;

    if (!leftCanUse && !rightCanUse) {
      return {
        phase: 'extended', reps: this.reps,
        feedbackLevel: 'idle', feedbackMessage: 'Asegúrate de que tu brazo sea visible',
        elbowAngle: 0, atTop: false, minAngleReached: 180, activeArm: 'both',
      };
    }

    if (this.repCooldown > 0) this.repCooldown--;

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

    // OR logic: cualquier brazo que complete el ciclo dispara la rep.
    // El cooldown absorbe la señal del segundo brazo en curls bilaterales (llega en los
    // ~0-50 ms siguientes) sin bloquear curls alternos donde el segundo brazo tarda >500 ms.
    const eitherRepCompleted = (leftRes?.repCompleted ?? false) || (rightRes?.repCompleted ?? false);
    if (eitherRepCompleted && this.repCooldown === 0) {
      this.reps++;
      this.repCooldown = REP_COOLDOWN_FRAMES;
    }

    // Ángulo primario: el brazo más contraído (menor ángulo)
    const elbowAngle = leftCanUse && rightCanUse
      ? Math.min(leftAngle, rightAngle)
      : leftCanUse ? leftAngle : rightAngle;

    // Fase agregada: flexed si cualquier brazo está contraído
    const phase: CurlPhase =
      leftRes?.phase === 'flexed' || rightRes?.phase === 'flexed' ? 'flexed' : 'extended';

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
      reps: this.reps,
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
    this.reps        = 0;
    this.repCooldown = 0;
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
