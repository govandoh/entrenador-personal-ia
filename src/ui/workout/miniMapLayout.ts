/**
 * Posición del mini mapa 3D (DEC-061), pura para poder probarla sin navegador.
 *
 * El mini mapa se guarda como "lado + altura relativa" y no en píxeles: así sobrevive a
 * girar el celular o a cambiar de dispositivo sin quedar fuera de la pantalla.
 */

export interface Insets { top: number; right: number; bottom: number; left: number }
export interface Box { width: number; height: number }
export interface Placement { side: 'left' | 'right'; y: number }

/** Separación con los bordes y con las áreas seguras, en px. */
export const EDGE_GAP = 8;
/** Altura reservada arriba para la barra superior del entrenamiento, en px. */
export const TOP_BAR = 64;

/** Borde inferior, en px, de lo que el panel no debe tapar en cada lado (contador, herramientas). */
export interface Ceiling { left: number; right: number }

/**
 * Zona donde puede estar el panel. `floorY` es el borde superior de los controles de abajo
 * (tarjeta de preparación o panel de la serie): el mini mapa nunca los tapa. `ceilingY` es
 * el borde inferior de lo que hay arriba en ese lado (el contador a la izquierda, la columna
 * de herramientas a la derecha): el panel se queda debajo si cabe; en pantallas donde no
 * cabe, vuelve a la zona completa bajo la barra superior.
 */
export function bounds(viewport: Box, panel: Box, safe: Insets, floorY = Infinity, ceilingY = -Infinity) {
  const minX = safe.left + EDGE_GAP;
  const maxX = Math.max(minX, viewport.width - panel.width - safe.right - EDGE_GAP);
  const barY = safe.top + TOP_BAR;
  const bottom = Math.min(viewport.height - safe.bottom, floorY);
  const lowest = bottom - panel.height - EDGE_GAP;
  const minY = ceilingY + EDGE_GAP <= lowest ? Math.max(barY, ceilingY + EDGE_GAP) : barY;
  const maxY = Math.max(minY, lowest);
  return { minX, maxX, minY, maxY };
}

/** Coordenadas en píxeles de una posición guardada. */
export function place(p: Placement, viewport: Box, panel: Box, safe: Insets, floorY?: number, ceiling?: Ceiling): { x: number; y: number } {
  const b = bounds(viewport, panel, safe, floorY, ceiling?.[p.side]);
  return { x: p.side === 'left' ? b.minX : b.maxX, y: b.minY + p.y * (b.maxY - b.minY) };
}

/**
 * Al soltar: se ancla al lado más cercano (como una imagen dentro de imagen) y la altura
 * se limita a la zona útil. Devuelve la posición guardable y dónde debe quedar.
 */
export function snap(x: number, y: number, viewport: Box, panel: Box, safe: Insets, floorY?: number, ceiling?: Ceiling): { placement: Placement; x: number; y: number } {
  const side: Placement['side'] = x + panel.width / 2 < viewport.width / 2 ? 'left' : 'right';
  const b = bounds(viewport, panel, safe, floorY, ceiling?.[side]);
  const cy = Math.min(b.maxY, Math.max(b.minY, y));
  const ratio = b.maxY > b.minY ? (cy - b.minY) / (b.maxY - b.minY) : 0;
  return { placement: { side, y: ratio }, x: side === 'left' ? b.minX : b.maxX, y: cy };
}
