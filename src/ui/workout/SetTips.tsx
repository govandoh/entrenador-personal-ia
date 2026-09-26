import { getExercise } from '../../domain/catalog';
import { getTutorial } from '../../domain/tutorials';
import { IconAlert, IconClose } from '../components/icons';

/**
 * Consejos durante la serie (DEC-061): una tarjeta corta con la clave del ejercicio, el
 * error más común y la respiración. Se oculta con un toque y la preferencia se recuerda.
 */
export function SetTips({ exerciseId, onHide }: { exerciseId: string; onHide: () => void }) {
  const exercise = getExercise(exerciseId);
  const tutorial = getTutorial(exerciseId);
  if (!exercise || !tutorial) return null;
  return (
    <aside className="set-tips" aria-label="Consejos">
      <button className="set-tips__close" aria-label="Ocultar consejos" onClick={onHide}><IconClose /></button>
      <p className="set-tips__cue">{exercise.cues}</p>
      <p className="set-tips__avoid"><IconAlert /><span>Evita: {tutorial.mistakes[0].replace(/\.$/, '').replace(/^./, c => c.toLowerCase())}.</span></p>
      <p className="set-tips__breath"><strong>Respira:</strong> {tutorial.breathing}</p>
    </aside>
  );
}
