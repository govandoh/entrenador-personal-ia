import {
  LM, WORLD_UP, angleBetween, calculateAngle3D, midpoint, normalize, subtract,
  type Landmark3D, type Vec3,
} from './vectors3d.ts';
import { alignToGravity } from './gravityAlign.ts';

/**
 * Calibración de la vertical con la postura de pie (ver DEC-053).
 *
 * Problema: aun con el acelerómetro corrigiendo la inclinación del celular (DEC-050), la
 * primera prueba real de fitnetv2 mostró el cuerpo entero inclinado unos 20° con la
 * persona derecha y el celular vertical. Es un error del modelo, no de la cámara: con una
 * sola cámara la profundidad es lo que peor estima MediaPipe, y el esqueleto queda rotado
 * como un bloque. El acelerómetro no puede verlo.
 *
 * Solución: de pie y con las piernas estiradas, el eje tobillos → hombros es vertical en
 * la realidad. Se mide cuánto se desvía ese eje en lo que estima el modelo y se descuenta
 * de todos los cuadros siguientes. Solo se aprende de posturas de pie.
 *
 * Limitación conocida: una hiperextensión de hasta ~25° todavía pasa el test de cadera
 * estirada (el ángulo 3D se pliega pasado 180°), así que durante el press un arqueo
 * moderado se absorbería en ~1 s. Por eso el pipeline debe llamar `setLearning(false)`
 * mientras dura el ejercicio y reactivarlo entre series.
 *
 * Portado de fitnetv2 (`src/pose/standingCalibration.ts`, commit 82e8783); se añadió
 * `setLearning`.
 */

/** Rodillas por encima de este ángulo cuentan como estiradas, en grados. */
const STRAIGHT_KNEE_DEG = 160;
/** Ángulo hombro-cadera-rodilla mínimo, en grados: el tronco sigue la línea de las piernas. */
const STRAIGHT_HIP_DEG = 155;
/** Visibilidad exigida: calibrar con puntos estimados fuera del cuadro sería peor que no calibrar. */
const MIN_VISIBILITY = 0.6;
/** Una desviación mayor, en grados, no es error de profundidad sino otra postura. */
const MAX_CORRECTION_DEG = 35;
/** Constante de tiempo del suavizado del eje, en ms. */
const SMOOTHING_MS = 800;
/** Tiempo de pie acumulado antes de aplicar la corrección, en ms. */
const MIN_STANDING_MS = 500;
/** Salto máximo entre cuadros que cuenta como tiempo de pie, en ms. */
const MAX_FRAME_GAP_MS = 100;

const REQUIRED = [
  LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP,
  LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE,
] as const;

/** De pie, cuerpo completo a la vista, rodillas y cadera estiradas. */
export function isStandingStraight(world: readonly Landmark3D[]): boolean {
  if (world.length <= LM.RIGHT_ANKLE) return false;
  if (!REQUIRED.every(i => (world[i].visibility ?? 0) >= MIN_VISIBILITY)) return false;

  const kneeL = calculateAngle3D(world[LM.LEFT_HIP], world[LM.LEFT_KNEE], world[LM.LEFT_ANKLE]);
  const kneeR = calculateAngle3D(world[LM.RIGHT_HIP], world[LM.RIGHT_KNEE], world[LM.RIGHT_ANKLE]);
  const hipL = calculateAngle3D(world[LM.LEFT_SHOULDER], world[LM.LEFT_HIP], world[LM.LEFT_KNEE]);
  const hipR = calculateAngle3D(world[LM.RIGHT_SHOULDER], world[LM.RIGHT_HIP], world[LM.RIGHT_KNEE]);

  return kneeL > STRAIGHT_KNEE_DEG && kneeR > STRAIGHT_KNEE_DEG &&
    hipL > STRAIGHT_HIP_DEG && hipR > STRAIGHT_HIP_DEG;
}

/** Eje del cuerpo, de tobillos a hombros, normalizado. */
function bodyAxis(world: readonly Landmark3D[]): Vec3 {
  const ankles = midpoint(world[LM.LEFT_ANKLE], world[LM.RIGHT_ANKLE]);
  const shoulders = midpoint(world[LM.LEFT_SHOULDER], world[LM.RIGHT_SHOULDER]);
  return normalize(subtract(shoulders, ankles));
}

export class StandingCalibrator {
  /** Eje del cuerpo de pie, suavizado. Apunta hacia arriba (y negativa). */
  private axis: Vec3 | null = null;
  private standingMs = 0;
  private lastTimeMs = -Infinity;
  private learning = true;

  /** Aprende de un cuadro si la persona está de pie y derecha. No modifica los landmarks. */
  update(world: readonly Landmark3D[], timeMs: number): void {
    const gap = timeMs - this.lastTimeMs;
    this.lastTimeMs = timeMs;
    if (!this.learning || !isStandingStraight(world)) return;

    const sample = bodyAxis(world);
    if (angleBetween(sample, WORLD_UP) > MAX_CORRECTION_DEG) return;

    const dt = gap > 0 && gap <= MAX_FRAME_GAP_MS ? gap : 0;
    if (!this.axis) {
      this.axis = sample;
    } else {
      const k = 1 - Math.exp(-dt / SMOOTHING_MS);
      this.axis = normalize({
        x: this.axis.x + (sample.x - this.axis.x) * k,
        y: this.axis.y + (sample.y - this.axis.y) * k,
        z: this.axis.z + (sample.z - this.axis.z) * k,
      });
    }
    this.standingMs += dt;
  }

  /** Congela (false) o reanuda (true) el aprendizaje sin perder la calibración vigente. */
  setLearning(enabled: boolean): void {
    this.learning = enabled;
  }

  get calibrated(): boolean {
    return this.axis !== null && this.standingMs >= MIN_STANDING_MS;
  }

  /** Grados que se corrigen, o `null` si todavía no hay calibración. */
  get correctionDeg(): number | null {
    return this.calibrated && this.axis ? angleBetween(this.axis, WORLD_UP) : null;
  }

  /** Gira el esqueleto para que el eje de pie aprendido quede vertical. */
  apply<T extends Landmark3D>(world: T[]): T[] {
    if (!this.calibrated || !this.axis) return world;
    // Llevar el eje "arriba" a (0,-1,0) es lo mismo que llevar su opuesto a (0,1,0).
    return alignToGravity(world, { x: -this.axis.x, y: -this.axis.y, z: -this.axis.z });
  }

  reset(): void {
    this.axis = null;
    this.standingMs = 0;
    this.lastTimeMs = -Infinity;
    this.learning = true;
  }
}
