import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { getExercise, type CatalogExercise, type Difficulty } from '../../domain/catalog';
import {
  addDay, addExercise, commitDraft, hasChanges, moveExercise, removeDay, removeExercise, renameDay, setDifficulty,
  setName, setWeekday, updateExercise, validateDraft, type ExercisePatch,
} from '../../domain/editorOps';
import { LIMITS, MAX_ROUTINE_NAME, emptyRoutine, type Routine, type RoutineDay, type RoutineExercise } from '../../domain/routines';
import type { TrainingMethod } from '../../domain/routineGenerator';
import { ExerciseFilterList } from '../components/ExerciseFilterList';
import { IconArrowDown, IconClose } from '../components/icons';
import { Sheet } from '../components/Sheet';
import { appActions, newId, useAppState } from '../state/appStore';
import { TechniqueSheet } from '../technique/TechniqueSheet';
import './routines.css';

/** Orden de la semana para mostrar: lunes primero. El modelo usa 0 = domingo … 6 = sábado. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEKDAY_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const LEVELS: { id: Difficulty; label: string }[] = [
  { id: 'bajo', label: 'Básico' },
  { id: 'medio', label: 'Intermedio' },
  { id: 'alto', label: 'Avanzado' },
];

const METHODS: { id: TrainingMethod; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'rest_pause', label: 'Rest-pause' },
  { id: 'dropset', label: 'Dropset' },
  { id: 'superset', label: 'Superserie' },
];

interface NumFieldProps {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  step?: number;
  /** Con `optional`, vaciar el campo borra el valor. */
  optional?: boolean;
  onCommit: (v: number | null) => void;
}

/**
 * Campo numérico con botones − y +. Se confirma al salir del campo (o con Enter): así se puede
 * borrar y reescribir sin que el valor salte a medias mientras se escribe.
 */
function NumField({ label, value, min, max, step = 1, optional = false, onCommit }: NumFieldProps) {
  const id = useMemo(() => `num-${newId()}`, []);
  const bump = (dir: 1 | -1) => onCommit(Math.min(max, Math.max(min, (value ?? 0) + dir * step)));
  function commit(raw: string) {
    const text = raw.trim().replace(',', '.');
    if (text === '') { if (optional) onCommit(null); return; }
    const n = Number(text);
    if (Number.isFinite(n)) onCommit(n);
  }
  return (
    <div className="num-field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="num-field__control">
        <button type="button" className="icon-btn" aria-label={`Menos ${label.toLowerCase()}`} onClick={() => bump(-1)} disabled={value !== undefined && value <= min}>−</button>
        <input
          id={id} key={value ?? 'vacío'} type="text" inputMode="decimal" defaultValue={value ?? ''}
          onBlur={e => commit(e.currentTarget.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
        <button type="button" className="icon-btn" aria-label={`Más ${label.toLowerCase()}`} onClick={() => bump(1)} disabled={value !== undefined && value >= max}>+</button>
      </div>
    </div>
  );
}

interface EntryEditorProps {
  entry: RoutineExercise;
  index: number;
  count: number;
  onPatch: (p: ExercisePatch) => void;
  onLevel: (d: Difficulty) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onTechnique: () => void;
}

function EntryEditor({ entry, index, count, onPatch, onLevel, onMove, onRemove, onTechnique }: EntryEditorProps) {
  const ex = getExercise(entry.exerciseId);
  const timed = entry.holdSeconds !== undefined;
  const name = ex?.name ?? entry.exerciseId;
  return (
    <div className="editor-entry">
      <div className="editor-entry__head">
        <button type="button" className="editor-entry__name" onClick={onTechnique} aria-label={`${name}: ver técnica`}>{name}</button>
        <div className="editor-entry__tools">
          <button type="button" className="icon-btn flip-v" aria-label={`Subir ${name}`} disabled={index === 0} onClick={() => onMove(-1)}><IconArrowDown /></button>
          <button type="button" className="icon-btn" aria-label={`Bajar ${name}`} disabled={index === count - 1} onClick={() => onMove(1)}><IconArrowDown /></button>
          <button type="button" className="icon-btn" aria-label={`Quitar ${name}`} onClick={onRemove}><IconClose /></button>
        </div>
      </div>
      <div className="editor-entry__fields">
        <NumField label="Series" value={entry.sets} min={LIMITS.sets[0]} max={LIMITS.sets[1]} onCommit={v => v !== null && onPatch({ sets: v })} />
        {timed ? (
          <NumField label="Segundos" value={entry.holdSeconds} min={LIMITS.holdSeconds[0]} max={LIMITS.holdSeconds[1]} step={5} onCommit={v => v !== null && onPatch({ holdSeconds: v })} />
        ) : (
          <NumField label="Repeticiones" value={entry.reps} min={LIMITS.reps[0]} max={LIMITS.reps[1]} onCommit={v => v !== null && onPatch({ reps: v })} />
        )}
        <NumField label="Descanso (s)" value={entry.restSeconds} min={LIMITS.restSeconds[0]} max={LIMITS.restSeconds[1]} step={15} onCommit={v => v !== null && onPatch({ restSeconds: v })} />
        <NumField label="Carga (kg)" value={entry.loadKg} min={LIMITS.loadKg[0]} max={LIMITS.loadKg[1]} step={2.5} optional onCommit={v => onPatch({ loadKg: v })} />
      </div>
      <div className="editor-entry__pair">
        <label className="num-field">
          <span className="field-label">Nivel</span>
          <select className="text-field" value={entry.difficulty} onChange={e => onLevel(e.target.value as Difficulty)}>
            {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
        <label className="num-field">
          <span className="field-label">Método</span>
          <select className="text-field" value={entry.method} onChange={e => onPatch({ method: e.target.value as TrainingMethod })}>
            {METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

/**
 * Editor de rutinas con guardado explícito (DEC-052). Trabaja sobre un borrador: nada se
 * persiste hasta "Crear rutina" o "Guardar cambios". Salir con cambios pendientes pregunta
 * (botón de volver, "Cancelar" y gesto de Android pasan por `useBlocker`); cerrar la pestaña
 * también avisa. Las operaciones sobre el borrador son funciones puras de `domain/editorOps`.
 */
export function RoutineEditorScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { routines } = useAppState();
  const isNew = id === 'nueva';

  // El borrador y la copia guardada se fijan al entrar; lo que cambie en el almacenamiento
  // mientras se edita no pisa lo que la persona está escribiendo.
  const [saved] = useState<Routine | null>(() => (isNew ? emptyRoutine(newId(), Date.now()) : routines.find(r => r.id === id) ?? null));
  const [draft, setDraft] = useState<Routine | null>(saved);
  const [nameError, setNameError] = useState<string | null>(null);
  const [pickerDay, setPickerDay] = useState<string | null>(null);
  const [technique, setTechnique] = useState<string | null>(null);
  const allowLeave = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const dirty = saved !== null && draft !== null && hasChanges(saved, draft);

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty && !allowLeave.current && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!saved || !draft) return <Navigate to="/rutinas" replace />;

  const edit = (fn: (d: Routine) => Routine) => setDraft(d => (d ? fn(d) : d));

  /** Valida y persiste. Devuelve false (y marca el campo) si el nombre falta. */
  function persist(): boolean {
    const error = validateDraft(draft as Routine);
    if (error) {
      setNameError(error);
      nameRef.current?.focus();
      return false;
    }
    appActions.saveRoutine(commitDraft(draft as Routine, Date.now()));
    allowLeave.current = true;
    return true;
  }

  function primary() {
    if (!isNew && !dirty) { allowLeave.current = true; navigate('/rutinas'); return; }
    if (persist()) navigate('/rutinas', { replace: true });
  }

  function saveAndLeave() {
    if (persist()) blocker.proceed?.();
    else blocker.reset?.();
  }

  const primaryLabel = isNew ? 'Crear rutina' : dirty ? 'Guardar cambios' : 'Listo';
  const pickerTarget = pickerDay;

  function onPick(ex: CatalogExercise) {
    if (!pickerTarget) return;
    edit(d => addExercise(d, pickerTarget, newId(), ex.id));
    setPickerDay(null);
  }

  return (
    <div className="editor">
      <div className="editor__body">
        <header className="screen-header">
          <div>
            <p className="muted">{isNew ? 'Rutina nueva' : 'Editar rutina'}</p>
            <h1 className="screen-title">{draft.name.trim() || 'Sin nombre'}</h1>
          </div>
        </header>

        <section className="card card--framed">
          <label className="field-label" htmlFor="routine-name">Nombre de la rutina</label>
          <input
            id="routine-name" ref={nameRef} className="text-field" value={draft.name} maxLength={MAX_ROUTINE_NAME}
            placeholder="Por ejemplo, Pierna y glúteo" aria-invalid={nameError !== null} aria-describedby={nameError ? 'routine-name-error' : undefined}
            onChange={e => { setNameError(null); edit(d => setName(d, e.target.value)); }}
          />
          {nameError && <p id="routine-name-error" className="field-error" role="alert">{nameError}</p>}
        </section>

        {draft.days.length === 0 && (
          <p className="muted">Todavía no tiene días. Agrega el primero y ponle ejercicios.</p>
        )}

        {draft.days.map((day: RoutineDay) => (
          <section key={day.id} className="card card--framed" aria-label={`Día ${day.name}`}>
            <div className="editor-day__head">
              <input
                className="text-field" value={day.name} maxLength={MAX_ROUTINE_NAME} aria-label="Nombre del día"
                onChange={e => edit(d => renameDay(d, day.id, e.target.value))}
              />
              <button type="button" className="icon-btn" aria-label={`Quitar ${day.name}`} onClick={() => edit(d => removeDay(d, day.id))}><IconClose /></button>
            </div>
            <div className="chip-row" role="group" aria-label="Día de la semana">
              {WEEK_ORDER.map(w => (
                <button key={w} type="button" className="chip" aria-pressed={day.weekday === w} aria-label={WEEKDAY_LONG[w]} onClick={() => edit(d => setWeekday(d, day.id, w))}>
                  {WEEKDAY_SHORT[w]}
                </button>
              ))}
            </div>

            {day.exercises.length === 0 && <p className="muted">Sin ejercicios en este día.</p>}
            {day.exercises.map((entry, i) => (
              <EntryEditor
                key={entry.id} entry={entry} index={i} count={day.exercises.length}
                onPatch={p => edit(d => updateExercise(d, day.id, entry.id, p))}
                onLevel={lv => edit(d => setDifficulty(d, day.id, entry.id, lv))}
                onMove={delta => edit(d => moveExercise(d, day.id, entry.id, delta))}
                onRemove={() => edit(d => removeExercise(d, day.id, entry.id))}
                onTechnique={() => setTechnique(entry.exerciseId)}
              />
            ))}
            <button type="button" className="btn btn--secondary btn--block" onClick={() => setPickerDay(day.id)}>Agregar ejercicio</button>
          </section>
        ))}

        <button
          type="button" className="btn btn--secondary btn--block" disabled={draft.days.length >= 7}
          onClick={() => edit(d => addDay(d, newId(), nextFreeWeekday(d)))}
        >
          Agregar día
        </button>
      </div>

      <div className="editor__bar">
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/rutinas')}>Cancelar</button>
        <button type="button" className="btn btn--primary" onClick={primary}>{primaryLabel}</button>
      </div>

      {pickerDay && (
        <Sheet label="Agregar ejercicio" onClose={() => setPickerDay(null)}>
          <ExerciseFilterList onPick={onPick} />
        </Sheet>
      )}
      {technique && <TechniqueSheet exerciseId={technique} onClose={() => setTechnique(null)} />}

      {blocker.state === 'blocked' && (
        <div className="confirm-scrim" role="presentation">
          <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="leave-title" aria-describedby="leave-desc">
            <h2 id="leave-title" className="card-title">¿Salir sin guardar?</h2>
            <p id="leave-desc" className="muted">Hiciste cambios en esta rutina que todavía no se guardan.</p>
            <button type="button" className="btn btn--primary btn--block" onClick={saveAndLeave}>Guardar y salir</button>
            <button type="button" className="btn btn--secondary btn--block btn--danger" onClick={() => { allowLeave.current = true; blocker.proceed(); }}>Descartar</button>
            <button type="button" className="btn btn--ghost btn--block" onClick={() => blocker.reset()}>Seguir editando</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Primer día de la semana (lunes primero) que la rutina todavía no usa; si todos están, lunes. */
function nextFreeWeekday(d: Routine): number {
  const used = new Set(d.days.map(x => x.weekday));
  return WEEK_ORDER.find(w => !used.has(w)) ?? 1;
}
