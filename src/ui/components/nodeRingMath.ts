/** Un nodo por landmark de MediaPipe Pose: el motivo de "la red de 33 puntos" (DEC-058). */
export const NODE_COUNT = 33;

/** Cuántos nodos se encienden para un progreso de 0 a 1: nunca 0 si hubo algo de avance. */
export function litNodes(value: number): number {
  const v = Math.min(1, Math.max(0, value));
  if (v === 0) return 0;
  return Math.max(1, Math.round(v * NODE_COUNT));
}
