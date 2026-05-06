export interface Point2D {
  x: number;
  y: number;
}

/**
 * Calcula el ángulo en el vértice B formado por los segmentos BA y BC.
 *
 * Rango de salida: 0–180 grados.
 * Usa atan2 para evitar divisiones por cero y manejar todos los cuadrantes.
 * Compatible con NormalizedLandmark de MediaPipe (que tiene x, y, z, visibility)
 * porque TypeScript acepta objetos con campos adicionales.
 */
export function calculateAngle(A: Point2D, B: Point2D, C: Point2D): number {
  const radians =
    Math.atan2(C.y - B.y, C.x - B.x) - Math.atan2(A.y - B.y, A.x - B.x);
  let degrees = Math.abs((radians * 180) / Math.PI);
  if (degrees > 180) degrees = 360 - degrees;
  return degrees;
}
