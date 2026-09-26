import { lazy, Suspense, useEffect, useRef } from 'react';
import { getDemo, sampleDemo } from '../../exercises/demoPoses';
import type { Pose3DHandle } from '../components/Pose3DView';

// three.js en un fragmento aparte (DEC-039): la ficha escrita aparece al instante y el
// modelo cuando la librería termina de llegar.
const Pose3DView = lazy(() => import('../components/Pose3DView'));

/**
 * Demostración animada de la técnica con los 33 puntos (DEC-043, DEC-061). El modelo se
 * puede girar en cualquier dirección y acercar; la fase y el ángulo se escriben directo
 * en el DOM desde el bucle de animación, sin renders de React por cuadro.
 */
export function ExerciseDemo3D({ exerciseId, compact = false }: { exerciseId: string; compact?: boolean }) {
  const def = getDemo(exerciseId);
  const viewRef = useRef<Pose3DHandle | null>(null);
  const phaseRef = useRef<HTMLSpanElement>(null);
  const angleRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!def) return;
    let frame = 0;
    let lastText = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const { p, phase } = sampleDemo(def, now - start);
      const world = def.pose(p);
      viewRef.current?.update(world);
      // Unas 12 veces por segundo bastan para que el texto se lea fluido.
      if (now - lastText > 80) {
        if (phaseRef.current && phaseRef.current.textContent !== phase.label) phaseRef.current.textContent = phase.label;
        if (angleRef.current) angleRef.current.textContent = `${Math.round(def.measure(world))}°`;
        lastText = now;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [def]);

  if (!def) return null;

  return (
    <figure className={`demo3d${compact ? ' demo3d--compact' : ''}`}>
      <div className="demo3d__stage">
        <Suspense fallback={<div className="pose3d demo3d__loading">Cargando el modelo…</div>}>
          <Pose3DView ref={viewRef} className="pose3d" initialRotation={def.initialRotation} autoRotate
            label="Modelo 3D de 33 puntos haciendo el ejercicio. Arrastra para girarlo." />
        </Suspense>
        <div className="demo3d__readout" aria-hidden="true">
          <span className="muted">{def.measureLabel}</span>
          <span className="display-number" ref={angleRef}>—</span>
        </div>
      </div>
      <figcaption className="demo3d__caption">
        <span className="demo3d__phase" ref={phaseRef}>{def.phases[0].label}</span>
        {!compact && <span className="muted">{def.targetText}</span>}
        <span className="demo3d__hint">Arrastra para girar · pellizca para acercar · doble toque para centrar</span>
      </figcaption>
    </figure>
  );
}
