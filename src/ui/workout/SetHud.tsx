import type { ReactNode } from 'react';
import type { AssistantId } from '../../domain/catalog';
import type { FeedbackLevel } from '../../exercises/tracker3d';
import type { RepQuality } from '../../analysis/setSummary';
import { IconAlert, IconArrowDown, IconCheck, IconClose } from '../components/icons';
import { EXTREME_LABEL } from './coaching';

export interface HudState {
  /** Repeticiones válidas de la serie (o segundos sostenidos en la plancha). */
  reps: number;
  level: FeedbackLevel;
  message: string;
  /** Ángulo extremo del último pico, en grados. */
  extreme: number | null;
  /** Duración de la última subida, en ms (solo motor 3D). */
  lastConcentricMs: number | null;
  qualities: RepQuality[];
  rejected: number;
}

interface SetHudProps {
  ex: AssistantId;
  hud: HudState;
  /** Repeticiones objetivo; `null` en ejercicios por tiempo. */
  target: number | null;
  engine3D: boolean;
  onFinish: () => void;
  onCancel: () => void;
  /** Tarjeta de consejos, si la persona la tiene visible. */
  tips?: ReactNode;
}

const ISLAND_ICON: Record<FeedbackLevel, ReactNode> = {
  idle: null,
  good: <IconCheck />,
  warning: <IconArrowDown />,
  bad: <IconAlert />,
};

/**
 * Pantalla durante la serie (DESIGN.md §5-6): contador grande, isla de aviso con lo mismo
 * que dice la voz, métricas y barra de repeticiones. Solo cambia cuando cambia el HUD
 * (una repetición, un aviso), nunca por cuadro.
 */
export function SetHud({ ex, hud, target, engine3D, onFinish, onCancel, tips }: SetHudProps) {
  const timed = target === null;
  const technique = hud.qualities.length > 0
    ? Math.round((hud.qualities.filter(q => q === 'good').length / hud.qualities.length) * 100)
    : null;
  const segments = timed ? 0 : Math.max(target, hud.qualities.length);
  const showIsland = hud.level !== 'idle' && hud.message !== '';

  return (
    <div className="hud">
      <div className="island" data-visible={showIsland} data-level={hud.level} role="status" aria-live="polite">
        <span className="island__icon">{ISLAND_ICON[hud.level]}</span>
        <span className="island__text">{hud.message}</span>
      </div>

      <div className="hud__counter" aria-live="polite" data-minimap-ceiling="left">
        <span key={hud.reps} className="display-number hud__reps">{hud.reps}</span>
        <span className="hud__of">
          {timed ? <span>segundos</span> : <><strong>/ {target}</strong><span>repeticiones</span></>}
        </span>
      </div>

      {tips}
      <div className="hud__spacer" />

      <section className="hud__panel" data-minimap-floor>
        <div className="hud__metrics">
          <div><span className="muted">{EXTREME_LABEL[ex]}</span><strong className="display-number">{hud.extreme === null ? '—' : `${hud.extreme}°`}</strong></div>
          {!timed && (
            <div><span className="muted">Subida</span><strong className="display-number">{engine3D && hud.lastConcentricMs !== null ? `${(hud.lastConcentricMs / 1000).toFixed(1).replace('.', ',')} s` : '—'}</strong></div>
          )}
          {!timed && <div><span className="muted">Técnica</span><strong className="display-number">{technique === null ? '—' : `${technique} %`}</strong></div>}
        </div>
        {!timed && (
          <div className="rep-bar" style={{ gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))` }}
            aria-label={`${hud.qualities.length} de ${target} repeticiones`}>
            {Array.from({ length: segments }, (_, i) => <span key={i} data-q={hud.qualities[i] ?? 'pending'} />)}
          </div>
        )}
        {hud.rejected > 0 && <p className="muted hud__rejected">{hud.rejected} {hud.rejected === 1 ? 'repetición no contada' : 'repeticiones no contadas'}</p>}
        <div className="hud__controls">
          <button className="icon-btn" aria-label="Cancelar la serie y volver a la preparación" onClick={onCancel}><IconClose /></button>
          <button className="btn btn--primary hud__finish" onClick={onFinish}>Terminar serie</button>
        </div>
      </section>
    </div>
  );
}
