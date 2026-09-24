import { useSyncExternalStore } from 'react';
import { isSetRecord, type SetRecord } from '../../domain/sessionHistory';
import { FREE_ENTITLEMENT, isEntitlement, type Entitlement } from '../../domain/payment';
import type { Questionnaire } from '../../domain/routineGenerator';
import { ALL_EQUIPMENT } from '../../domain/catalog';

/**
 * Estado local de la app (historial, cuestionario, suscripción simulada, voz).
 *
 * Vive en `localStorage` mientras no exista `api-client` (DEC-024: siempre con try/catch y
 * validación). Si el almacenamiento está bloqueado, la app funciona igual con el estado en
 * memoria de la sesión: nunca se pierde lo que ya se tenía por un error de escritura.
 */

export interface AppState {
  history: SetRecord[];
  questionnaire: Questionnaire | null;
  /** Inicio del programa, ISO 8601: define en qué semana se está. */
  programStartedAt: string | null;
  entitlement: Entitlement;
  voiceEnabled: boolean;
}

const KEYS = {
  history: 'fitnet_history_v1',
  profile: 'fitnet_profile_v1',
  entitlement: 'fitnet_entitlement_v1',
} as const;

/** Series que se conservan en el dispositivo. */
const MAX_HISTORY = 1000;

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* almacenamiento lleno, bloqueado o en modo privado: se sigue en memoria */
  }
}

function isQuestionnaire(v: unknown): v is Questionnaire {
  if (typeof v !== 'object' || v === null) return false;
  const q = v as Record<string, unknown>;
  return ['muscle_gain', 'weight_loss', 'strength_gain'].includes(q.goal as string) &&
    ['beginner', 'intermediate', 'advanced'].includes(q.level as string) &&
    ['gym_full', 'home_none', 'home_limited'].includes(q.location as string) &&
    typeof q.daysPerWeek === 'number' && q.daysPerWeek >= 2 && q.daysPerWeek <= 6 &&
    typeof q.sessionMinutes === 'number' &&
    (q.equipment === undefined || (Array.isArray(q.equipment) && q.equipment.every(e => ALL_EQUIPMENT.includes(e)))) &&
    (q.programType === undefined || ['full_body', 'upper_lower', 'ppl'].includes(q.programType as string));
}

function load(): AppState {
  const history = read(KEYS.history);
  const profile = read(KEYS.profile) as Record<string, unknown> | null;
  const entitlement = read(KEYS.entitlement);
  return {
    history: Array.isArray(history) ? history.filter(isSetRecord) : [],
    questionnaire: profile && isQuestionnaire(profile.questionnaire) ? profile.questionnaire : null,
    programStartedAt: profile && typeof profile.programStartedAt === 'string' ? profile.programStartedAt : null,
    voiceEnabled: profile && typeof profile.voiceEnabled === 'boolean' ? profile.voiceEnabled : true,
    entitlement: isEntitlement(entitlement) ? entitlement : FREE_ENTITLEMENT,
  };
}

let state: AppState = load();
const listeners = new Set<() => void>();

function set(next: Partial<AppState>): void {
  state = { ...state, ...next };
  if ('history' in next) write(KEYS.history, state.history);
  if ('questionnaire' in next || 'programStartedAt' in next || 'voiceEnabled' in next) {
    write(KEYS.profile, {
      questionnaire: state.questionnaire,
      programStartedAt: state.programStartedAt,
      voiceEnabled: state.voiceEnabled,
    });
  }
  if ('entitlement' in next) write(KEYS.entitlement, state.entitlement);
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, () => state);
}

export const appActions = {
  addSet(record: SetRecord): void {
    set({ history: [...state.history, record].slice(-MAX_HISTORY) });
  },
  saveQuestionnaire(q: Questionnaire, now: Date): void {
    set({ questionnaire: q, programStartedAt: now.toISOString() });
  },
  setEntitlement(e: Entitlement): void {
    set({ entitlement: e });
  },
  setVoice(enabled: boolean): void {
    set({ voiceEnabled: enabled });
  },
};

/** Semana del programa en curso (0 = semana 1) según la fecha de inicio. */
export function currentProgramWeek(startedAt: string | null, now: Date): number {
  if (!startedAt) return 0;
  const days = Math.floor((now.getTime() - Date.parse(startedAt)) / 86_400_000);
  return Math.max(0, Math.floor(days / 7));
}
