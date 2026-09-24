import type { FatigueLevel } from './fatigue';
import type { RejectionReason } from './movementQuality';

/**
 * Textos en español (`es-ES`) asociados a los resultados del análisis.
 *
 * Viven aparte de la lógica para que los analizadores devuelvan solo claves: la política
 * de feedback (PR 4, DEC-016) decide qué se dice y cuándo, y los tests no dependen de la
 * redacción. Textos tomados de fitnetv2 (registro en tuteo, DEC-049).
 */

/** Mensaje cuando se descarta una repetición. */
export const REJECTION_MESSAGES: Record<RejectionReason, string> = {
  too_fast:         'Movimiento muy rápido, controla el recorrido',
  too_slow:         'Repetición muy lenta, mantén el ritmo',
  insufficient_rom: 'Recorrido incompleto, no cuenta',
  erratic:          'Movimiento irregular, busca un recorrido continuo',
};

/** Mensaje para cada nivel de fatiga. */
export const FATIGUE_MESSAGES: Record<FatigueLevel, string> = {
  fresh:    'Ritmo sólido',
  moderate: 'Fatiga leve, mantén la técnica',
  high:     'Fatiga alta, quedan pocas repeticiones buenas',
  critical: 'Fatiga crítica, corta la serie y descansa',
};
