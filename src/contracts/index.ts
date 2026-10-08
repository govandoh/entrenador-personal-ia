/**
 * Contratos compartidos entre workstreams (co-propiedad de B y D, docs/WORKSTREAMS.md §2).
 *
 * Solo tipos, sin dependencias. Se editan en ramas `contracts/*` o `adr/*` con dos
 * aprobaciones, y cada cambio sube `CONTRACTS_VERSION`: parche = documentación; menor =
 * campos opcionales nuevos; mayor = cambio rompiente.
 */

export const CONTRACTS_VERSION = '1.0.0';

export type { Landmark, LandmarkFrame, Vec3 } from './pose.ts';
export type { ExerciseId, ExerciseTracker, FeedbackLevel, RepEvent, TrackerOutput } from './tracking.ts';
