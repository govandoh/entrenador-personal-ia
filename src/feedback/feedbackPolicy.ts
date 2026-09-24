/**
 * Política de voz (ver DEC-016), extraída de `CameraView` (PR 4 de ARCHITECTURE.md §2.4).
 *
 * Decide QUÉ se dice y CUÁNDO a partir de los eventos del contador, sin tocar el DOM ni
 * el sintetizador: devuelve las frases y la UI las pasa a `useSpeech`. La usan los dos
 * motores (2D de producción y 3D de DEC-057), así que ambos hablan igual.
 *
 * Dos estrategias, según dónde está el momento útil para corregir:
 *
 * - `mid-range-peak` (sentadilla): la técnica se juzga en el fondo, a mitad de la rep, y
 *   se dice en ese momento. El número de la rep se dice al volver arriba, pero no más de
 *   uno cada `REP_SPEECH_MIN_MS` para no pisar la frase del fondo.
 * - `peak-at-end-of-effort` (curl, press): el pico llega al final del esfuerzo y la rep se
 *   cierra poco después; decir la técnica en el pico chocaría con el número. Se guarda y se
 *   dice junto con el número: "3. ¡Excelente contracción!".
 *
 * Además (motor 3D), las repeticiones descartadas se anuncian como mucho una vez cada
 * `REJECTION_SPEECH_MIN_MS`.
 */

export type FeedbackStrategy = 'mid-range-peak' | 'peak-at-end-of-effort';

/** Separación mínima entre el número de la rep y la frase anterior, en ms (sentadilla). */
export const REP_SPEECH_MIN_MS = 1500;
/** Separación mínima entre avisos de repetición descartada, en ms. */
export const REJECTION_SPEECH_MIN_MS = 2000;

export interface FeedbackEvent {
  /** Instante del frame, en ms. */
  now: number;
  /** Repeticiones contadas hasta este frame. */
  reps: number;
  /** true si en este frame se contó una repetición. */
  repCounted: boolean;
  /** Frase de técnica si en este frame se confirmó el pico o fondo; si no, `null`. */
  peakPhrase: string | null;
  /** Motivo de descarte a anunciar, si se descartó un ciclo en este frame. */
  rejectionMessage?: string | null;
}

/** Cómo se dice el número de la repetición: palabra para la primera, ánimo cada 5 y 10. */
export function repPhrase(n: number): string {
  if (n === 1)      return 'Una';
  if (n % 10 === 0) return `${n}. ¡Excelente ritmo!`;
  if (n % 5 === 0)  return `${n}. ¡Sigue así!`;
  return String(n);
}

export class FeedbackPolicy {
  private strategy: FeedbackStrategy;
  private pendingPeakPhrase = '';
  private lastSpeakMs = -Infinity;
  private lastRejectionMs = -Infinity;

  constructor(strategy: FeedbackStrategy) {
    this.strategy = strategy;
  }

  /** Frases a decir en este frame (normalmente ninguna o una). */
  decide(e: FeedbackEvent): string[] {
    if (e.repCounted) {
      if (this.strategy === 'mid-range-peak') {
        if (e.now - this.lastSpeakMs <= REP_SPEECH_MIN_MS) return [];
        this.lastSpeakMs = e.now;
        return [repPhrase(e.reps)];
      }
      const phrase = this.pendingPeakPhrase
        ? `${repPhrase(e.reps)}. ${this.pendingPeakPhrase}`
        : repPhrase(e.reps);
      this.pendingPeakPhrase = '';
      this.lastSpeakMs = e.now;
      return [phrase];
    }

    if (e.peakPhrase) {
      if (this.strategy === 'mid-range-peak') {
        this.lastSpeakMs = e.now;
        return [e.peakPhrase];
      }
      this.pendingPeakPhrase = e.peakPhrase;
      return [];
    }

    if (e.rejectionMessage && e.now - this.lastRejectionMs > REJECTION_SPEECH_MIN_MS) {
      this.lastRejectionMs = e.now;
      return [e.rejectionMessage];
    }
    return [];
  }

  /**
   * Cambio de ejercicio: nueva estrategia y se descarta la frase pendiente. El instante de
   * la última frase se conserva, como en el MVP (una sola voz para toda la sesión).
   */
  setStrategy(strategy: FeedbackStrategy): void {
    this.strategy = strategy;
    this.pendingPeakPhrase = '';
  }

  /** Descarta la frase pendiente. */
  reset(): void {
    this.pendingPeakPhrase = '';
  }
}
