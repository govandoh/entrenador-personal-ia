import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EXERCISE_CATALOG } from '../../domain/catalog';
import { startHref } from '../../domain/sessionBuild';
import { ExerciseFilterList } from '../components/ExerciseFilterList';
import { IconPlay } from '../components/icons';
import { TechniqueSheet } from '../technique/TechniqueSheet';

export function ExercisesScreen() {
  const [technique, setTechnique] = useState<string | null>(null);

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="muted">{EXERCISE_CATALOG.length} ejercicios · {EXERCISE_CATALOG.filter(e => e.assistant).length} con asistente</p>
          <h1 className="screen-title">Ejercicios</h1>
        </div>
      </header>

      <ExerciseFilterList
        renderDetail={e => {
          // Una sola función decide a dónde va cada ejercicio (cámara o modo manual).
          const href = startHref(e.id);
          return (
            <>
              <p className="cues">{e.cues}</p>
              <button className="btn btn--secondary btn--block" onClick={() => setTechnique(e.id)}>Ver técnica en 3D</button>
              {href && (
                <Link className="btn btn--primary btn--block" to={href}>
                  <IconPlay />{e.assistant ? 'Entrenar con asistente' : 'Entrenar sin cámara'}
                </Link>
              )}
            </>
          );
        }}
      />
      {technique && <TechniqueSheet exerciseId={technique} onClose={() => setTechnique(null)} showTrainAction />}
    </div>
  );
}
