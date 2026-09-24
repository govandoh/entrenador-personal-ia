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
  /** Preferencias de vista (DEC-061): cada persona decide qué ayudas ve. */
  view: ViewPrefs;
}

export interface ViewPrefs {
  /** Modelo 3D de demostración en la ficha de técnica. */
  showDemo: boolean;
  /** Mini mapa 3D flotante durante el entrenamiento. */
  showMiniMap: boolean;
  /** Tarjeta de consejos durante la serie. */
  showTips: boolean;
  /** Posición del mini mapa: lado de la pantalla y altura relativa (0 arriba, 1 abajo). */
  miniMap: { side: 'left' | 'right'; y: number };
}

export const DEFAULT_VIEW: ViewPrefs = {
  showDemo: true,
  showMiniMap: true,
  showTips: false,
  miniMap: { side: 'left', y: 0.35 },
};

function readView(v: unknown): ViewPrefs {
  if (typeof v !== 'object' || v === null) return DEFAULT_VIEW;
  const o = v as Record<string, unknown>;
  const m = o.miniMap as Record<string, unknown> | undefined;
  const bool = (x: unknown, d: boolean) => (typeof x === 'boolean' ? x : d);
  return {
    showDemo: bool(o.showDemo, DEFAULT_VIEW.showDemo),
    showMiniMap: bool(o.showMiniMap, DEFAULT_VIEW.showMiniMap),
    showTips: bool(o.showTips, DEFAULT_VIEW.showTips),
    miniMap: m && (m.side === 'left' || m.side === 'right') && typeof m.y === 'number' && m.y >= 0 && m.y <= 1
      ? { side: m.side, y: m.y } : DEFAULT_VIEW.miniMap,
  };
}

const KEYS = {
  history: 'fitnet_history_v1',
  profile: 'fitnet_profile_v1',
  entitlement: 'fitnet_entitlement_v1',
  view: 'fitnet_view_v1',
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
    view: readView(read(KEYS.view)),
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
  if ('view' in next) write(KEYS.view, state.view);
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
  setView(patch: Partial<ViewPrefs>): void {
    set({ view: { ...state.view, ...patch } });
  },
};

/** Semana del programa en curso (0 = semana 1) según la fecha de inicio. */
export function currentProgramWeek(startedAt: string | null, now: Date): number {
  if (!startedAt) return 0;
  const days = Math.floor((now.getTime() - Date.parse(startedAt)) / 86_400_000);
  return Math.max(0, Math.floor(days / 7));
}
