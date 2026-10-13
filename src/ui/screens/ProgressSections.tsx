import { useState } from 'react';
import {
  GOAL_LABEL, GOAL_RANGE, clampTarget, computeAchievements, goalProgress, type Goal, type GoalKind, type Stats,
} from '../../domain/progress';
import { IconCheck, IconFlame, IconLock, IconTarget } from '../components/icons';
import { MAX_GOALS, appActions, newId } from '../state/appStore';
import './progress.css';

/** "1 día", "3 días". */
function days(n: number): string {
  return n === 1 ? ' día' : ' días';
}

const KINDS = Object.keys(GOAL_LABEL) as GoalKind[];

/** Valor inicial razonable del objetivo de cada tipo. */
const DEFAULT_TARGET: Record<GoalKind, number> = { weekly_days: 3, total_reps: 500, total_sets: 50, streak_days: 7 };

function Meter({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      {/* Se llena con transform, no con width: no fuerza maquetación en cada cambio. */}
      <span className="meter__fill" style={{ transform: `scaleX(${pct / 100})` }} />
    </div>
  );
}

/** Rachas, técnica y semana: lo que las tarjetas de totales del perfil no muestran. */
export function ProgressStats({ stats }: { stats: Stats }) {
  return (
    <div className="grid-2">
      <div className="card"><span className="muted">Racha</span><span className="display-number stat-number">{stats.streak}<small>{days(stats.streak)}</small></span></div>
      <div className="card"><span className="muted">Mejor racha</span><span className="display-number stat-number">{stats.bestStreak}<small>{days(stats.bestStreak)}</small></span></div>
      <div className="card"><span className="muted">Esta semana</span><span className="display-number stat-number">{stats.daysThisWeek}<small> / 7</small></span></div>
      <div className="card">
        <span className="muted">Técnica limpia</span>
        <span className="display-number stat-number">{stats.techniquePct === null ? '—' : stats.techniquePct}{stats.techniquePct !== null && <small> %</small>}</span>
      </div>
    </div>
  );
}

export function GoalsSection({ goals, stats }: { goals: readonly Goal[]; stats: Stats }) {
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<GoalKind>('weekly_days');
  const [target, setTarget] = useState(String(DEFAULT_TARGET.weekly_days));
  const [min, max] = GOAL_RANGE[kind];

  function changeKind(next: GoalKind) {
    setKind(next);
    setTarget(String(DEFAULT_TARGET[next]));
  }

  function add() {
    appActions.saveGoal({ id: newId(), kind, target: clampTarget(kind, Number(target)), createdAt: Date.now() });
    setAdding(false);
  }

  return (
    <section className="card card--framed" aria-label="Objetivos">
      <h2 className="card-title">Objetivos</h2>
      {goals.length === 0 && !adding && <p className="muted">Ponte una meta y mira cuánto te falta. Se calcula sola con tu historial.</p>}
      {goals.map(g => {
        const p = goalProgress(g, stats);
        const info = GOAL_LABEL[g.kind];
        return (
          <div key={g.id} className="goal">
            <div className="goal__head">
              <span className="list-row__main">
                <span className="list-row__title">{info.title}</span>
                <span className="list-row__meta">{p.current} de {p.target} {info.unit}</span>
              </span>
              {p.done && <span className="pill pill--volt"><IconCheck />Cumplido</span>}
              <button type="button" className="btn btn--ghost goal__remove" onClick={() => appActions.deleteGoal(g.id)} aria-label={`Quitar objetivo ${info.title}`}>Quitar</button>
            </div>
            <Meter pct={p.pct} label={`${info.title}: ${p.pct} %`} />
          </div>
        );
      })}

      {adding ? (
        <div className="goal-form">
          <label className="num-field">
            <span className="field-label">Tipo de objetivo</span>
            <select className="text-field" value={kind} onChange={e => changeKind(e.target.value as GoalKind)}>
              {KINDS.map(k => <option key={k} value={k}>{GOAL_LABEL[k].title}</option>)}
            </select>
          </label>
          <label className="num-field">
            <span className="field-label">Meta ({GOAL_LABEL[kind].unit}, de {min} a {max})</span>
            <input className="text-field" type="text" inputMode="numeric" value={target} onChange={e => setTarget(e.target.value.replace(/[^\d]/g, ''))} />
          </label>
          <div className="goal-form__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setAdding(false)}>Cancelar</button>
            <button type="button" className="btn btn--primary" disabled={target === ''} onClick={add}>Agregar objetivo</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn--secondary btn--block" disabled={goals.length >= MAX_GOALS} onClick={() => setAdding(true)}>
          <IconTarget />{goals.length >= MAX_GOALS ? `Máximo ${MAX_GOALS} objetivos` : 'Agregar objetivo'}
        </button>
      )}
    </section>
  );
}

export function AchievementsSection({ stats }: { stats: Stats }) {
  const list = computeAchievements(stats);
  const unlocked = list.filter(a => a.unlocked).length;
  return (
    <section className="card card--framed" aria-label="Logros">
      <div className="goal__head">
        <h2 className="card-title">Logros</h2>
        <span className="muted">{unlocked} de {list.length}</span>
      </div>
      <ul className="achievements">
        {list.map(a => (
          <li key={a.id} className="achievement" data-unlocked={a.unlocked}>
            <span className="achievement__icon" aria-hidden="true">{a.unlocked ? <IconFlame /> : <IconLock />}</span>
            <span className="list-row__main">
              <span className="list-row__title">{a.title}</span>
              <span className="list-row__meta">{a.unlocked ? 'Desbloqueado' : a.description}</span>
            </span>
            {!a.unlocked && <span className="achievement__pct">{a.pct} %</span>}
            {!a.unlocked && <Meter pct={a.pct} label={`${a.title}: ${a.pct} %`} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
