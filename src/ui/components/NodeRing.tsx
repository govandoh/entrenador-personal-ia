import type { CSSProperties, ReactNode } from 'react';
import { NODE_COUNT, litNodes } from './nodeRingMath';

interface NodeRingProps {
  /** Progreso entre 0 y 1. */
  value: number;
  size?: number;
  /** Enciende los nodos en cadena (celebración de serie completada, DESIGN.md §6). */
  celebrate?: boolean;
  label: string;
  children?: ReactNode;
}

export function NodeRing({ value, size = 150, celebrate = false, label, children }: NodeRingProps) {
  const lit = litNodes(value);
  const c = size / 2;
  const radius = size / 2 - 9;
  const dots = Array.from({ length: NODE_COUNT }, (_, i) => {
    const a = -Math.PI / 2 + (i / NODE_COUNT) * Math.PI * 2;
    return { x: c + radius * Math.cos(a), y: c + radius * Math.sin(a), on: i < lit };
  });

  return (
    <div className={`node-ring${celebrate ? ' node-ring--celebrate' : ''}`} style={{ width: `min(${size}px, 38vw)` }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={d.on ? 5 : 3.6}
            fill={d.on ? 'var(--color-volt)' : 'var(--color-line)'}
            data-on={d.on}
            style={{ '--i': i } as CSSProperties}
          />
        ))}
      </svg>
      {children && <div className="node-ring__center">{children}</div>}
    </div>
  );
}
