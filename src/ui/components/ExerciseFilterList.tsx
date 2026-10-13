import { useMemo, useState, type ReactNode } from 'react';
import { EXERCISE_CATALOG, type CatalogExercise, type EquipmentTag, type MuscleGroup } from '../../domain/catalog';
import { filterExercises, type ExerciseFilterId } from '../../domain/exerciseFilter';
import { IconAssist, IconChevron, IconSearch } from './icons';

const FILTERS: { id: ExerciseFilterId; label: string }[] = [
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

const DIFFICULTY_LABEL: Record<CatalogExercise['baseDifficulty'], string> = { bajo: 'Básico', medio: 'Intermedio', alto: 'Avanzado' };

interface ExerciseFilterListProps {
  /** Solo muestra lo que se puede hacer con este equipo. */
  equipment?: ReadonlySet<EquipmentTag>;
  /** Selector: tocar un ejercicio lo elige. Sin esto, cada fila se expande. */
  onPick?: (exercise: CatalogExercise) => void;
  /** Biblioteca: contenido que aparece al expandir una fila. */
  renderDetail?: (exercise: CatalogExercise) => ReactNode;
  /** Texto de los resultados vacíos. */
  emptyText?: string;
}

/**
 * Buscador, filtros y lista de ejercicios, común a la biblioteca y al selector del editor de
 * rutinas (issue #34). La regla de qué entra en cada filtro vive en `domain/exerciseFilter`.
 */
export function ExerciseFilterList({ equipment, onPick, renderDetail, emptyText = 'Ningún ejercicio coincide con la búsqueda.' }: ExerciseFilterListProps) {
  const [filter, setFilter] = useState<ExerciseFilterId>('all');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(
    () => filterExercises({ filter, muscle, text, equipment }, EXERCISE_CATALOG),
    [filter, muscle, text, equipment],
  );

  return (
    <>
      <label className="search">
        <IconSearch />
        <span className="visually-hidden">Buscar ejercicio</span>
        <input type="search" value={text} onChange={e => setText(e.target.value)} placeholder="Buscar ejercicio" enterKeyHint="search" />
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
        {list.length === 0 && <p className="muted">{emptyText}</p>}
        {list.map(e => {
          const expanded = open === e.id;
          const meta = (
            <span className="exercise-row__inner">
              <span className="list-row__main">
                <span className="list-row__title">{e.name}</span>
                <span className="list-row__meta">{e.equipmentLabel} · {DIFFICULTY_LABEL[e.baseDifficulty]}</span>
              </span>
              {e.assistant && <span className="badge-assist"><IconAssist />Asistente</span>}
              {!onPick && <span className="chevron" data-open={expanded}><IconChevron /></span>}
            </span>
          );
          return (
            <div key={e.id} className="exercise-item">
              {onPick ? (
                <button className="exercise-row" onClick={() => onPick(e)} aria-label={`Agregar ${e.name}`}>{meta}</button>
              ) : (
                <button className="exercise-row" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : e.id)}>{meta}</button>
              )}
              {!onPick && expanded && renderDetail && <div className="exercise-detail">{renderDetail(e)}</div>}
            </div>
          );
        })}
      </section>
    </>
  );
}
