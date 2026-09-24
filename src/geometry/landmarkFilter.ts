import type { Landmark3D } from './vectors3d.ts';

/**
 * Suavizado de landmarks con filtro One Euro (ver DEC-046).
 *
 * Problema: los `worldLandmarks` tiemblan entre 5 y 15 mm cuadro a cuadro aunque la
 * persona esté quieta. En el antebrazo, 15 mm son varios grados de ángulo, y ese temblor
 * se cuela en el conteo, en la velocidad que alimenta la fatiga y en el visor 3D. También
 * es la causa del spike de un frame que adelanta el fondo de la sentadilla
 * (`fixtures/README.md`, comportamiento congelado 2).
 *
 * Por qué One Euro y no un promedio móvil: un promedio fijo obliga a elegir entre
 * temblor y retraso. El One Euro adapta su frecuencia de corte a la velocidad: filtra
 * fuerte con el punto casi quieto y deja pasar el movimiento rápido, donde el retraso sí
 * importaría. Referencia: Casiez, Roussel y Vogel, "1€ Filter", CHI 2012.
 *
 * Se aplica al análisis, no al dibujo sobre el video. Portado de fitnetv2
 * (`src/pose/landmarkFilter.ts`, commit d456e95); es matemática pura del workstream B.
 */

/** Frecuencia de corte mínima, en Hz: cuánto se suaviza con el punto quieto. */
const MIN_CUTOFF_HZ = 1.2;
/** Aumento de la frecuencia de corte por cada m/s de velocidad (coordenadas en metros). */
const BETA = 0.8;
/** Frecuencia de corte del estimador de velocidad, en Hz. */
const DERIVATE_CUTOFF_HZ = 1.0;
/**
 * Pausa máxima entre cuadros antes de reiniciar el filtro, en ms. Si el detector pierde a
 * la persona un momento, arrastrar la posición vieja produciría una transición falsa.
 */
const MAX_GAP_MS = 500;
/** Intervalo supuesto para el primer cuadro tras un reinicio, en segundos (solo inicializa). */
const DEFAULT_DT_S = 1 / 30;

function smoothingFactor(cutoffHz: number, dtSeconds: number): number {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSeconds);
}

export class OneEuroFilter {
  private prevValue = 0;
  private prevDerivative = 0;
  private initialized = false;

  filter(value: number, dtSeconds: number): number {
    if (!this.initialized) {
      this.initialized = true;
      this.prevValue = value;
      this.prevDerivative = 0;
      return value;
    }

    const rawDerivative = (value - this.prevValue) / dtSeconds;
    const aD = smoothingFactor(DERIVATE_CUTOFF_HZ, dtSeconds);
    const derivative = aD * rawDerivative + (1 - aD) * this.prevDerivative;

    const cutoff = MIN_CUTOFF_HZ + BETA * Math.abs(derivative);
    const a = smoothingFactor(cutoff, dtSeconds);
    const filtered = a * value + (1 - a) * this.prevValue;

    this.prevValue = filtered;
    this.prevDerivative = derivative;
    return filtered;
  }

  reset(): void {
    this.initialized = false;
  }
}

/** Mantiene un filtro por coordenada de cada landmark. `timeMs` es el `t` del frame. */
export class LandmarkSmoother {
  private filters: OneEuroFilter[][] = [];
  private lastTimeMs = -Infinity;

  smooth<T extends Landmark3D>(world: readonly T[], timeMs: number): T[] {
    const gap = timeMs - this.lastTimeMs;
    if (gap > MAX_GAP_MS || gap <= 0) this.reset();

    const dtSeconds = Number.isFinite(gap) && gap > 0 ? gap / 1000 : DEFAULT_DT_S;
    this.lastTimeMs = timeMs;

    while (this.filters.length < world.length) {
      this.filters.push([new OneEuroFilter(), new OneEuroFilter(), new OneEuroFilter()]);
    }

    return world.map((p, i) => {
      const [fx, fy, fz] = this.filters[i];
      // La visibilidad no se suaviza: los trackers la usan como compuerta y un valor
      // retrasado dejaría pasar cuadros donde el punto ya no se ve.
      return {
        ...p,
        x: fx.filter(p.x, dtSeconds),
        y: fy.filter(p.y, dtSeconds),
        z: fz.filter(p.z, dtSeconds),
      };
    });
  }

  reset(): void {
    for (const trio of this.filters) for (const f of trio) f.reset();
    this.lastTimeMs = -Infinity;
  }
}
