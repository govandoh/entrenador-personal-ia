import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getExercise } from '../../domain/catalog';
import { muscleGroupsOf, type Routine, type RoutineExercise } from '../../domain/routines';
import { startPath } from '../../domain/sessionBuild';
import { IconAssist } from '../components/icons';
import { appActions, useAppState } from '../state/appStore';
import './routines.css';

const WEEKDAY = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function dose(e: RoutineExercise): string {
  return e.holdSeconds !== undefined ? `${e.sets} × ${e.holdSeconds} s` : `${e.sets} × ${e.reps ?? 0}`;
}

/**
 * Dirección para entrenar una entrada de rutina. Una sola función decide cámara o manual
 * (`startPath`); en manual se pasa la entrada para que la serie use los números de la rutina.
 */
function entryHref(e: RoutineExercise): string | null {
  const p = startPath(e.exerciseId);
  if (!p) return null;
  return p.kind === 'camera' ? `/entrenar?ex=${p.assistant}` : `/manual?entry=${e.id}`;
}

function RoutineCard({ routine }: { routine: Routine }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const days = [...routine.days].sort((a, b) => WEEK_ORDER.indexOf(a.weekday) - WEEK_ORDER.indexOf(b.weekday));
  const total = routine.days.reduce((n, d) => n + d.exercises.length, 0);

  return (
    <section className="card card--framed" aria-label={`Rutina ${routine.name}`}>
      <div className="routine-card__head">
        <div>
          <h3 className="card-title">{routine.name || 'Sin nombre'}</h3>
          <span className="muted">{routine.days.length} {routine.days.length === 1 ? 'día' : 'días'} · {total} ejercicios</span>
        </div>
        {routine.active && <span className="pill pill--volt">Activa</span>}
      </div>

      <button type="button" className="btn btn--ghost btn--block" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Ocultar ejercicios' : 'Ver ejercicios'}
      </button>

      {open && days.length === 0 && <p className="muted">Esta rutina no tiene días todavía.</p>}
      {open && days.map(day => (
        <div key={day.id} className="list">
          <div className="day-card__head">
            <strong>{day.name}</strong>
            <span className="muted">{WEEKDAY[day.weekday]}{muscleGroupsOf(day).length > 0 ? ` · ${muscleGroupsOf(day).join(', ')}` : ''}</span>
          </div>
          {day.exercises.map(e => {
            const ex = getExercise(e.exerciseId);
            const href = entryHref(e);
            const row = (
              <>
                <span className="list-row__main">
                  <span className="list-row__title">{ex?.name ?? e.exerciseId}</span>
                  <span className="list-row__meta">Descanso {e.restSeconds} s{e.loadKg !== undefined ? ` · ${e.loadKg} kg` : ''}</span>
                </span>
                {ex?.assistant && <span className="badge-assist"><IconAssist />Asistente</span>}
                <span className="list-row__value">{dose(e)}</span>
              </>
            );
            return href
              ? <Link key={e.id} className="list-row exercise-row" to={href} aria-label={`Entrenar ${ex?.name ?? e.exerciseId}`}>{row}</Link>
              : <div key={e.id} className="list-row">{row}</div>;
          })}
        </div>
      ))}

      <div className="routine-card__actions">
        <Link className="btn btn--secondary" to={`/rutinas/editar/${routine.id}`}>Editar</Link>
        <button type="button" className="btn btn--secondary" onClick={() => appActions.activateRoutine(routine.active ? null : routine.id)}>
          {routine.active ? 'Desactivar' : 'Activar'}
        </button>
        {confirmDelete ? (
          <>
            <button type="button" className="btn btn--secondary btn--danger" onClick={() => appActions.deleteRoutine(routine.id)}>Sí, eliminar</button>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(false)}>No</button>
          </>
        ) : (
          <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(true)}>Eliminar</button>
        )}
      </div>
    </section>
  );
}

/** "Mis rutinas": las propias y las plantillas, con editor, activación y entrenamiento. */
export function MyRoutines() {
  const { routines } = useAppState();
  return (
    <>
      <header className="screen-header">
        <h2 className="screen-title" style={{ fontSize: 'var(--text-card-title)' }}>Mis rutinas</h2>
      </header>
      {routines.length === 0 && <p className="muted">No tienes rutinas. Crea la primera y arma tus días.</p>}
      {routines.map(r => <RoutineCard key={r.id} routine={r} />)}
      <Link className="btn btn--primary btn--block" to="/rutinas/editar/nueva">Crear rutina</Link>
    </>
  );
}
