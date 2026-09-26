import type { AssistantId } from '../../domain/catalog';
import { FORM_ISSUE_LABELS, type SetSummary } from '../../analysis/setSummary';
import { NodeRing } from '../components/NodeRing';
import { IconTrendDown } from '../components/icons';
import { ASSISTED_NAMES } from './exercises';

interface SetSummaryViewProps {
  ex: AssistantId;
  setNumber: number;
  summary: SetSummary | null;
  heldSeconds: number | null;
  onNextSet: () => void;
  onFinish: () => void;
}

/** Caída de velocidad a partir de la cual se avisa de fatiga moderada (DEC-038: 10 %). */
const FATIGUE_NOTICE_PCT = 10;

const REJECTION_LABEL: Record<string, string> = {
  too_fast: 'demasiado rápida',
  too_slow: 'demasiado lenta',
  insufficient_rom: 'recorrido corto',
  erratic: 'movimiento irregular',
};

/**
 * Resumen de la serie (DESIGN.md §5). Es el único momento de celebración: el anillo de
 * técnica enciende sus 33 nodos en cadena (DESIGN.md §6).
 */
export function SetSummaryView({ ex, setNumber, summary, heldSeconds, onNextSet, onFinish }: SetSummaryViewProps) {
  const timed = heldSeconds !== null;
  const valid = timed ? heldSeconds : summary?.validReps ?? 0;
  const technique = summary && summary.validReps > 0 ? summary.goodReps / summary.validReps : timed ? 1 : 0;
  const velocities = summary?.reps.map(r => r.concentricVelocity).filter((v): v is number => v !== null) ?? [];
  const maxV = Math.max(...velocities, 1);
  const tail = Math.max(0, velocities.length - 3);
  const drop = summary?.velocityDropPercent ?? null;
  const issues = Object.entries(summary?.formIssues ?? {}).sort((a, b) => b[1] - a[1]);
  const rejected = Object.entries(summary?.rejected ?? {});

  return (
    <div className="summary screen stagger">
      <div style={{ '--i': 0 } as React.CSSProperties}>
        <p className="eyebrow">{ASSISTED_NAMES[ex]} · Serie {setNumber}</p>
        <h1 className="screen-title">{valid > 0 ? 'Serie completada' : 'Serie sin repeticiones'}</h1>
      </div>

      <section className="card card--framed summary__hero" style={{ '--i': 1 } as React.CSSProperties}>
        <NodeRing value={technique} size={112} celebrate label={`Técnica ${Math.round(technique * 100)} %`}>
          <span className="display-number summary__pct">{valid > 0 ? Math.round(technique * 100) : '—'}</span>
        </NodeRing>
        <div>
          <p className="display-number summary__valid">{valid} {timed ? 's' : valid === 1 ? 'válida' : 'válidas'}</p>
          {rejected.map(([reason, n]) => (
            <p key={reason} className="muted">{n} no {n === 1 ? 'contada' : 'contadas'}: {REJECTION_LABEL[reason] ?? reason}</p>
          ))}
          {!timed && valid > 0 && <p className="is-indigo summary__tech">Técnica {Math.round(technique * 100)} %</p>}
          {valid === 0 && <p className="muted">No se contó ninguna. Revisa que se vea {ex === 'curl' || ex === 'press' ? 'tu torso completo' : 'tu cuerpo completo'} y vuelve a intentarlo.</p>}
        </div>
      </section>

      {velocities.length >= 2 && (
        <section className="card" style={{ '--i': 2 } as React.CSSProperties}>
          <div className="day-card__head"><strong>Velocidad de subida</strong><span className="muted">por repetición</span></div>
          <div className="velocity-chart" style={{ gridTemplateColumns: `repeat(${velocities.length}, minmax(0, 1fr))` }}
            role="img" aria-label={`Velocidad de subida de ${velocities.length} repeticiones${drop !== null ? `, bajó ${drop} %` : ''}`}>
            {velocities.map((v, i) => (
              <span key={i} data-late={i >= tail && velocities.length > 3} style={{ transform: `scaleY(${v / maxV})` }} />
            ))}
          </div>
          <div className="day-card__head muted"><span>Rep 1</span><span>Rep {velocities.length}</span></div>
          {drop !== null && drop >= FATIGUE_NOTICE_PCT && (
            <p className="notice notice--amber"><IconTrendDown />Bajó {drop} % al final: {drop >= 20 ? 'fatiga alta, descansa más' : 'fatiga moderada'}</p>
          )}
        </section>
      )}

      {issues.length > 0 && (
        <section className="card" style={{ '--i': 3 } as React.CSSProperties}>
          <strong>Para la próxima serie</strong>
          <div className="list">
            {issues.map(([code, n]) => (
              <div key={code} className="list-row">
                <span className="list-row__main"><span className="list-row__title">{FORM_ISSUE_LABELS[code] ?? code}</span></span>
                <span className="list-row__value">{n} {n === 1 ? 'rep' : 'reps'}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flow__spacer" />
      <button className="btn btn--primary btn--block" onClick={onNextSet} data-autofocus>Siguiente serie</button>
      <button className="btn btn--secondary btn--block" onClick={onFinish}>Terminar sesión</button>
    </div>
  );
}
