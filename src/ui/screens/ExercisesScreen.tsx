import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EXERCISE_CATALOG, type CatalogExercise, type MuscleGroup } from '../../domain/catalog';
import { IconAssist, IconChevron, IconPlay, IconSearch } from '../components/icons';

type Filter = 'all' | 'assist' | 'bodyweight';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'assist', label: 'Con asistente' },
  { id: 'bodyweight', label: 'Sin equipo' },
];

const MUSCLES: { id: MuscleGroup; label: string }[] = [
  { id: 'pecho', label: 'Pecho' },
  { id: 'espalda', label: 'Espalda' },
  { id: 'hombros', label: 'Hombros' },
  { id: 'biceps', label: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps' },
  { id: 'cuadriceps', label: 'Cuádriceps' },
  { id: 'isquiotibiales', label: 'Isquiotibiales' },
  { id: 'gluteos', label: 'Glúteos' },
  { id: 'pantorrillas', label: 'Pantorrillas' },
  { id: 'core', label: 'Core' },
  { id: 'cardio', label: 'Cardio' },
];

const DIFFICULTY: Record<CatalogExercise['baseDifficulty'], string> = { bajo: 'Básico', medio: 'Intermedio', alto: 'Avanzado' };

/** Quita acentos para que "biceps" encuentre "Bíceps". */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function matches(e: CatalogExercise, filter: Filter, muscle: MuscleGroup | null, query: string): boolean {
  if (filter === 'assist' && !e.assistant) return false;
  if (filter === 'bodyweight' && !e.equipment.some(o => o.length === 1 && o[0] === 'bodyweight')) return false;
  if (muscle && e.muscleGroup !== muscle && !e.secondary.includes(muscle)) return false;
  return query === '' || fold(e.name).includes(fold(query));
}

export function ExercisesScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(
    () => EXERCISE_CATALOG.filter(e => matches(e, filter, muscle, query.trim()))
      .sort((a, b) => Number(Boolean(b.assistant)) - Number(Boolean(a.assistant))),
    [filter, muscle, query],
  );

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="muted">{EXERCISE_CATALOG.length} ejercicios · {EXERCISE_CATALOG.filter(e => e.assistant).length} con asistente</p>
          <h1 className="screen-title">Ejercicios</h1>
        </div>
      </header>

      <label className="search">
        <IconSearch />
        <span className="visually-hidden">Buscar ejercicio</span>
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar ejercicio" enterKeyHint="search" />
      </label>

      <div className="chip-row" role="group" aria-label="Filtrar">
        {FILTERS.map(f => (
          <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.id === 'assist' && <IconAssist />}{f.label}
          </button>
        ))}
      </div>
      <div className="chip-row" role="group" aria-label="Grupo muscular">
        {MUSCLES.map(m => (
          <button key={m.id} className="chip" aria-pressed={muscle === m.id} onClick={() => setMuscle(muscle === m.id ? null : m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      <section className="card list" aria-live="polite">
        {list.length === 0 && <p className="muted">Ningún ejercicio coincide con la búsqueda.</p>}
        {list.map(e => {
          const expanded = open === e.id;
          return (
            <div key={e.id} className="exercise-item">
              <button className="exercise-row" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : e.id)}>
                <span className="exercise-row__inner">
                  <span className="list-row__main">
                    <span className="list-row__title">{e.name}</span>
                    <span className="list-row__meta">{e.equipmentLabel} · {DIFFICULTY[e.baseDifficulty]}</span>
                  </span>
                  {e.assistant && <span className="badge-assist"><IconAssist />Asistente</span>}
                  <span className="chevron" data-open={expanded}><IconChevron /></span>
                </span>
              </button>
              {expanded && (
                <div className="exercise-detail">
                  <p className="cues">{e.cues}</p>
                  {e.assistant && (
                    <Link className="btn btn--primary btn--block" to={`/entrenar?ex=${e.assistant}`}>
                      <IconPlay />Entrenar con asistente
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
