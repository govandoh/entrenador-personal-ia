import { lazy, Suspense, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type Ref } from 'react';
import type { Landmark3D } from '../../geometry/vectors3d';
import { getDemo, sampleDemo } from '../../exercises/demoPoses';
import type { Pose3DHandle } from '../components/Pose3DView';
import { IconClose } from '../components/icons';
import { appActions, useAppState } from '../state/appStore';
import { place, snap, type Box, type Ceiling, type Insets } from './miniMapLayout';

const Pose3DView = lazy(() => import('../components/Pose3DView'));

export interface MiniMapHandle {
  /** Esqueleto en vivo; se ignora mientras se muestra el ejemplo. */
  updateLive(world: readonly Landmark3D[]): void;
}

interface MiniMap3DProps {
  ref?: Ref<MiniMapHandle | null>;
  /** Ejercicio del catálogo para el modelo de ejemplo. */
  demoId: string;
  onHide: () => void;
  /** Cambia cuando cambian los controles de abajo (fase): fuerza a recolocar el panel. */
  layoutKey: string;
  /** Celular nivelado según el acelerómetro; `null` sin sensor (no se muestra). */
  levelOk: boolean | null;
  /** Aviso corto bajo el modelo (por ejemplo, la calibración de pie). */
  hint: string | null;
}

/** Áreas seguras resueltas en px (una propiedad CSS con env() no se resuelve al leerla). */
function readSafeInsets(): Insets {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const insets = { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
  probe.remove();
  return insets;
}

/**
 * Mini mapa 3D durante el entrenamiento (DEC-061): el esqueleto de 33 puntos en vivo
 * (por defecto) o el modelo de ejemplo (interruptor "Ejemplo"), que se puede girar dentro del panel y arrastrar por la
 * pantalla desde su barra. Al soltarlo se ancla al borde más cercano dentro del área
 * segura, con la curva de cajón (DESIGN.md §6). El arrastre escribe `transform` directo:
 * ningún render de React por movimiento.
 */
export function MiniMap3D({ ref, demoId, onHide, layoutKey, levelOk, hint }: MiniMap3DProps) {
  const { view } = useAppState();
  const [mode, setMode] = useState<'live' | 'demo'>('live');
  const panelRef = useRef<HTMLElement>(null);
  const poseRef = useRef<Pose3DHandle | null>(null);
  const modeRef = useRef(mode);
  const pos = useRef({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const demo = getDemo(demoId);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  useImperativeHandle(ref, () => ({
    updateLive(world) {
      if (modeRef.current === 'live') poseRef.current?.update(world);
    },
  }), []);

  // Ejemplo: la misma demostración de la ficha de técnica, en bucle.
  useEffect(() => {
    if (mode !== 'demo' || !demo) return;
    let frame = 0;
    const start = performance.now();
    const loop = (now: number) => {
      poseRef.current?.update(demo.pose(sampleDemo(demo, now - start).p));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [mode, demo]);

  const measure = (): { viewport: Box; panel: Box; safe: Insets; floor: number; ceiling: Ceiling } | null => {
    const el = panelRef.current;
    if (!el) return null;
    // Los controles de abajo se marcan con data-minimap-floor; el mini mapa se queda encima.
    const floorEl = document.querySelector('[data-minimap-floor]');
    const floor = floorEl ? floorEl.getBoundingClientRect().top : Infinity;
    // Lo que no debe tapar arriba se marca con data-minimap-ceiling="left|right" (contador,
    // herramientas); el mini mapa se queda debajo si cabe.
    const ceiling: Ceiling = { left: -Infinity, right: -Infinity };
    for (const c of document.querySelectorAll<HTMLElement>('[data-minimap-ceiling]')) {
      const side = c.dataset.minimapCeiling;
      if (side === 'left' || side === 'right') ceiling[side] = Math.max(ceiling[side], c.getBoundingClientRect().bottom);
    }
    return { viewport: { width: innerWidth, height: innerHeight }, panel: { width: el.offsetWidth, height: el.offsetHeight }, safe: readSafeInsets(), floor, ceiling };
  };

  const apply = (x: number, y: number, animate: boolean) => {
    const el = panelRef.current;
    if (!el) return;
    pos.current = { x, y };
    el.style.transition = animate ? 'transform var(--dur-sheet) var(--ease-drawer)' : 'none';
    el.style.transform = `translate(${x}px, ${y}px)`;
  };

  // Colocación inicial y al girar el celular, desde la posición guardada.
  useLayoutEffect(() => {
    const relayout = () => {
      const m = measure();
      if (!m) return;
      const p = place(view.miniMap, m.viewport, m.panel, m.safe, m.floor, m.ceiling);
      apply(p.x, p.y, false);
    };
    relayout();
    addEventListener('resize', relayout);
    // Si los controles de abajo cambian de alto (otra fase, la barra de calibración), se recoloca.
    const floorEl = document.querySelector('[data-minimap-floor]');
    const ro = floorEl ? new ResizeObserver(relayout) : null;
    if (floorEl) ro!.observe(floorEl);
    return () => { removeEventListener('resize', relayout); ro?.disconnect(); };
  }, [view.miniMap, layoutKey]);

  function onGripDown(e: PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: pos.current.x, y: pos.current.y };
  }
  function onGripMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    apply(d.x + e.clientX - d.px, d.y + e.clientY - d.py, false);
  }
  function onGripUp() {
    if (!drag.current) return;
    drag.current = null;
    const m = measure();
    if (!m) return;
    const s = snap(pos.current.x, pos.current.y, m.viewport, m.panel, m.safe, m.floor, m.ceiling);
    apply(s.x, s.y, !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    appActions.setView({ miniMap: s.placement });
  }
  // Teclado: flechas para cambiar de lado y subir o bajar el panel.
  function onGripKey(e: KeyboardEvent<HTMLDivElement>) {
    const p = view.miniMap;
    const next = e.key === 'ArrowLeft' ? { ...p, side: 'left' as const }
      : e.key === 'ArrowRight' ? { ...p, side: 'right' as const }
        : e.key === 'ArrowUp' ? { ...p, y: Math.max(0, p.y - 0.1) }
          : e.key === 'ArrowDown' ? { ...p, y: Math.min(1, p.y + 0.1) } : null;
    if (!next) return;
    e.preventDefault();
    appActions.setView({ miniMap: next });
  }

  return (
    <section ref={panelRef} className="minimap" aria-label="Modelo 3D">
      <div className="minimap__grip" onPointerDown={onGripDown} onPointerMove={onGripMove} onPointerUp={onGripUp} onPointerCancel={onGripUp}
        tabIndex={0} role="toolbar" aria-label="Mover el modelo 3D: arrastra o usa las flechas" onKeyDown={onGripKey}>
        <span className="minimap__handle" aria-hidden="true" />
        <button className="minimap__close" aria-label="Ocultar el modelo 3D" onClick={onHide}><IconClose /></button>
      </div>
      <div className="minimap__stage">
        <Suspense fallback={<div className="pose3d minimap__loading">3D…</div>}>
          <Pose3DView ref={poseRef} className="pose3d" initialRotation={demo?.initialRotation ?? 0}
            label={mode === 'live' ? 'Tu esqueleto en 3D en tiempo real. Arrastra para girarlo.' : 'Modelo de ejemplo en 3D. Arrastra para girarlo.'} />
        </Suspense>
        {/* Estado del celular y de la calibración encima del modelo; no captan toques (el modelo se gira). */}
        {levelOk !== null && (
          <span className="minimap__badge" data-ok={levelOk}>{levelOk ? 'Nivelado' : 'Inclinado'}</span>
        )}
        {hint && mode === 'live' && <span className="minimap__hint">{hint}</span>}
      </div>
      {/* Un solo interruptor (y no dos opciones) para que quepa con 40 px de alto en 320 px de ancho. */}
      {demo && (
        <button className="minimap__mode" aria-pressed={mode === 'demo'} onClick={() => setMode(m => (m === 'demo' ? 'live' : 'demo'))}>
          Ejemplo
        </button>
      )}
    </section>
  );
}
