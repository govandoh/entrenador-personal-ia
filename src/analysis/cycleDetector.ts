/**
 * Detector de ciclos de repetición sobre un ángulo primario (ver DEC-057).
 *
 * Unifica los tres detectores del MVP y de fitnetv2 (`SquatTracker`, `ArmTracker`,
 * `ArmPressTracker`), que eran el mismo algoritmo con polaridad distinta:
 *
 * - **Histéresis de doble umbral** (DEC-010): el ciclo entra en esfuerzo al cruzar
 *   `effortDeg` y vuelve a reposo al cruzar `restDeg`; la zona intermedia conserva la fase.
 * - **Confirmación del extremo por margen en grados** (DEC-044): el pico/fondo se
 *   confirma cuando el ángulo ya se alejó `confirmMarginDeg` del extremo acumulado. No
 *   depende de cuántos frames haya, a diferencia de la confirmación por frames
 *   consecutivos (`0.5°/frame × 3`) de fitnetv2, que a 60 fps no confirmaba un giro lento.
 * - **Gate de recorrido inicial** opcional (`minStartDeg`, DEC-017/022): el reposo previo
 *   debe haber llegado lo bastante lejos del esfuerzo para que la rep cuente.
 *
 * Polaridad `min`: el esfuerzo es el ángulo MÍNIMO (fondo de sentadilla, cima del curl).
 * Polaridad `max`: el esfuerzo es el ángulo MÁXIMO (bloqueo del press).
 * Módulo puro: no mide tiempo; la validación temporal la hace `MovementAnalyzer`.
 */

export type Polarity = 'min' | 'max';
export type CyclePhase = 'rest' | 'effort';

export interface CycleConfig {
  polarity: Polarity;
  /** Umbral de vuelta al reposo, en grados. */
  restDeg: number;
  /** Umbral de entrada al esfuerzo, en grados. */
  effortDeg: number;
  /** Cuánto debe alejarse el ángulo del extremo para confirmarlo, en grados. */
  confirmMarginDeg: number;
  /** Ángulo que el reposo previo debe haber alcanzado para que la rep cuente, en grados. */
  minStartDeg?: number;
}

export interface CycleUpdate {
  phase: CyclePhase;
  /** true solo en el frame en que se entra en esfuerzo. */
  cycleStarted: boolean;
  /** true solo en el frame en que se confirma el extremo (pico o fondo). */
  peakConfirmed: boolean;
  /** true solo en el frame en que se cierra un ciclo completo y válido por posición. */
  cycleCompleted: boolean;
  /** Extremo alcanzado en el ciclo en curso (o el último, al cerrarse). */
  extremeDeg: number;
}

export class CycleDetector {
  private phase: CyclePhase = 'rest';
  private extreme: number;
  private restExtreme: number;
  private startExtreme: number;
  private peakFired = false;
  private readonly cfg: CycleConfig;

  constructor(cfg: CycleConfig) {
    this.cfg = cfg;
    this.extreme = this.neutralEffort();
    this.restExtreme = this.neutralRest();
    this.startExtreme = this.neutralRest();
  }

  get currentPhase(): CyclePhase {
    return this.phase;
  }

  get peakReached(): boolean {
    return this.peakFired;
  }

  update(angle: number): CycleUpdate {
    const { polarity, restDeg, effortDeg, confirmMarginDeg, minStartDeg } = this.cfg;
    const isMin = polarity === 'min';
    const prevPhase = this.phase;

    if (isMin ? angle > restDeg : angle < restDeg) this.phase = 'rest';
    else if (isMin ? angle < effortDeg : angle > effortDeg) this.phase = 'effort';

    // En reposo se registra lo más lejos que llegó del esfuerzo (gate de recorrido inicial).
    if (this.phase === 'rest' && (isMin ? angle > this.restExtreme : angle < this.restExtreme)) {
      this.restExtreme = angle;
    }

    const cycleStarted = this.phase === 'effort' && prevPhase !== 'effort';
    if (cycleStarted) this.startExtreme = this.restExtreme;

    const startOk = minStartDeg === undefined ||
      (isMin ? this.startExtreme >= minStartDeg : this.startExtreme <= minStartDeg);
    const cycleCompleted = prevPhase === 'effort' && this.phase === 'rest' && this.peakFired && startOk;
    const extremeDeg = this.extreme;

    let peakConfirmed = false;
    if (this.phase === 'effort') {
      if (isMin ? angle < this.extreme : angle > this.extreme) this.extreme = angle;
      const away = isMin ? angle - this.extreme : this.extreme - angle;
      if (!this.peakFired && away >= confirmMarginDeg) {
        peakConfirmed = true;
        this.peakFired = true;
      }
    }

    if (this.phase === 'rest' && prevPhase !== 'rest') {
      this.peakFired = false;
      this.extreme = this.neutralEffort();
      this.restExtreme = angle;
    }

    return {
      phase: this.phase,
      cycleStarted,
      peakConfirmed,
      cycleCompleted,
      extremeDeg: this.phase === 'effort' ? this.extreme : extremeDeg,
    };
  }

  reset(): void {
    this.phase = 'rest';
    this.extreme = this.neutralEffort();
    this.restExtreme = this.neutralRest();
    this.startExtreme = this.neutralRest();
    this.peakFired = false;
  }

  /** Valor inicial del extremo de esfuerzo: el opuesto a la polaridad. */
  private neutralEffort(): number {
    return this.cfg.polarity === 'min' ? Infinity : -Infinity;
  }

  private neutralRest(): number {
    return this.cfg.polarity === 'min' ? -Infinity : Infinity;
  }
}
