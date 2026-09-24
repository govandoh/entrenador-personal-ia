import { useEffect, useRef, type ReactNode } from 'react';

interface SheetProps {
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/** Distancia o velocidad de arrastre hacia abajo que cierra la hoja. */
const DISMISS_PX = 110;
const DISMISS_VELOCITY = 0.5; // px/ms
/** Respaldo si `transitionend` no llega (movimiento reducido, pestaña oculta), en ms. */
const CLOSE_FALLBACK_MS = 450;

/**
 * Hoja inferior (patrón Family Drawer de Cult UI, DESIGN.md §6). Entra con
 * `@starting-style` y la curva de cajón; se cierra tocando fuera, con Escape o arrastrando
 * hacia abajo, y sale por el mismo camino. El arrastre mueve la hoja con `transform`
 * directamente sobre el elemento, sin renders de React por movimiento.
 */
export function Sheet({ label, onClose, children }: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);
  const closing = useRef(false);

  function close() {
    const sheet = sheetRef.current;
    if (!sheet || closing.current) return;
    closing.current = true;
    sheet.style.transform = 'translateY(100%)';
    if (scrimRef.current) scrimRef.current.style.opacity = '0';
    let done = false;
    const finish = () => { if (!done) { done = true; onClose(); } };
    sheet.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, CLOSE_FALLBACK_MS);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    sheetRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => window.removeEventListener('keydown', onKey);
    // close es estable en la práctica: solo usa refs y onClose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { y: e.clientY, t: e.timeStamp, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !sheetRef.current) return;
    d.dy = Math.max(0, e.clientY - d.y);
    sheetRef.current.style.transform = `translateY(${d.dy}px)`;
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    const sheet = sheetRef.current;
    if (!d || !sheet) return;
    sheet.style.transition = '';
    const velocity = d.dy / Math.max(1, e.timeStamp - d.t);
    if (d.dy > DISMISS_PX || velocity > DISMISS_VELOCITY) close();
    else sheet.style.transform = '';
  }

  return (
    <>
      <div ref={scrimRef} className="sheet-scrim" onClick={close} aria-hidden="true" />
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {/* Zona de arrastre: el resto de la hoja conserva el desplazamiento vertical nativo. */}
        <div
          className="sheet__grab"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="sheet__handle" />
        </div>
        {children}
        <button className="btn btn--ghost btn--block" onClick={close}>Cerrar</button>
      </div>
    </>
  );
}
