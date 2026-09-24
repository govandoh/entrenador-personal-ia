import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Sheet } from '../components/Sheet';
import { IconAlert, IconAssist, IconPlay } from '../components/icons';
import { getExercise } from '../../domain/catalog';
import { TUTORIAL_DISCLAIMER, getTutorial } from '../../domain/tutorials';
import { getDemo } from '../../exercises/demoPoses';
import { appActions, useAppState } from '../state/appStore';
import { ExerciseDemo3D } from './ExerciseDemo3D';
import './technique.css';

type Tab = 'how' | 'mistakes' | 'breathing' | 'phone';

interface TechniqueSheetProps {
  exerciseId: string;
  onClose: () => void;
  /** "Entrenar con asistente" desde el catálogo o el programa; en la preparación no hace falta. */
  showTrainAction?: boolean;
}

const MUSCLE: Record<string, string> = {
  pecho: 'Pecho', espalda: 'Espalda', hombros: 'Hombros', biceps: 'Bíceps', triceps: 'Tríceps',
  cuadriceps: 'Cuádriceps', isquiotibiales: 'Isquiotibiales', gluteos: 'Glúteos', pantorrillas: 'Pantorrillas',
  core: 'Core', cardio: 'Cardio',
};

/**
 * Ficha de técnica (DEC-043, DEC-061): demostración 3D que se puede ocultar y, debajo,
 * una sola sección visible a la vez (cómo hacerlo, errores, respiración, celular) para no
 * cargar la hoja. El indicador de pestaña se desliza con transform (patrón Direction Aware
 * Tabs de Cult UI).
 */
export function TechniqueSheet({ exerciseId, onClose, showTrainAction = false }: TechniqueSheetProps) {
  const exercise = getExercise(exerciseId);
  const tutorial = getTutorial(exerciseId);
  const { view } = useAppState();
  const [tab, setTab] = useState<Tab>('how');
  if (!exercise || !tutorial) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'how', label: 'Pasos' },
    { id: 'mistakes', label: 'Errores' },
    { id: 'breathing', label: 'Respiración' },
    ...(tutorial.cameraSetup ? [{ id: 'phone' as const, label: 'Celular' }] : []),
  ];
  const index = Math.max(0, tabs.findIndex(t => t.id === tab));
  const hasDemo = Boolean(getDemo(exerciseId));

  return (
    <Sheet label={`Técnica: ${exercise.name}`} onClose={onClose}>
      <header className="technique__head">
        <div>
          <p className="eyebrow">{MUSCLE[exercise.muscleGroup] ?? exercise.muscleGroup} · {exercise.equipmentLabel}</p>
          <h2 className="card-title">{exercise.name}</h2>
        </div>
        {exercise.assistant && <span className="badge-assist"><IconAssist />Asistente</span>}
      </header>

      {hasDemo && (
        <section className="technique__demo">
          <div className="technique__row">
            <span className="field-label">Modelo 3D de 33 puntos</span>
            <button className="btn btn--ghost technique__toggle" aria-pressed={view.showDemo}
              onClick={() => appActions.setView({ showDemo: !view.showDemo })}>
              {view.showDemo ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          {view.showDemo && <ExerciseDemo3D exerciseId={exerciseId} />}
        </section>
      )}

      <p className="technique__cue">{exercise.cues}</p>

      <div className="tabs" role="tablist" aria-label="Secciones de la técnica"
        style={{ '--tabs': tabs.length, '--tab': index } as CSSProperties}>
        <span className="tabs__indicator" aria-hidden="true" />
        {tabs.map(t => (
          <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls="technique-panel"
            className="tabs__tab" onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div id="technique-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="technique__panel" key={tab}>
        {tab === 'how' && (
          <ol className="technique__steps">
            {tutorial.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        )}
        {tab === 'mistakes' && (
          <ul className="technique__mistakes">
            {tutorial.mistakes.map((m, i) => <li key={i}><IconAlert />{m}</li>)}
          </ul>
        )}
        {tab === 'breathing' && <p className="technique__text">{tutorial.breathing}</p>}
        {tab === 'phone' && tutorial.cameraSetup && <p className="technique__text">{tutorial.cameraSetup}</p>}
      </div>

      {tutorial.safety && <p className="notice notice--amber" role="note"><IconAlert />{tutorial.safety}</p>}
      <p className="muted technique__disclaimer">{TUTORIAL_DISCLAIMER}</p>

      {showTrainAction && exercise.assistant && (
        <Link className="btn btn--primary btn--block" to={`/entrenar?ex=${exercise.assistant}`}>
          <IconPlay />Entrenar con asistente
        </Link>
      )}
    </Sheet>
  );
}
