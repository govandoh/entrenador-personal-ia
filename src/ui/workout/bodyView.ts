import { LM, getBodyOrientation, type BodyOrientation, type Landmark3D } from '../../geometry/vectors3d';

/**
 * Etiqueta "Vista" del entrenamiento: cómo ve la cámara a la persona (de frente, de perfil
 * o en diagonal). La ficha de técnica dice qué vista conviene para cada ejercicio; con la
 * etiqueta la persona comprueba si está bien colocada sin adivinar. Funciones puras para
 * poder probarlas sin cámara.
 */

export const VIEW_LABEL: Record<BodyOrientation, string> = {
  frontal: 'De frente',
  diagonal: 'En diagonal',
  lateral: 'De perfil',
};

/** Tiempo que una vista nueva tiene que mantenerse antes de mostrarla, en ms. */
export const VIEW_STABLE_MS = 400;
/** Visibilidad mínima de los hombros para estimar la vista. */
const MIN_SHOULDER_VISIBILITY = 0.5;

/** Vista del cuerpo en el cuadro, o `null` si no se ven los dos hombros. */
export function bodyView(world: readonly Landmark3D[] | null | undefined): BodyOrientation | null {
  if (!world || world.length <= LM.RIGHT_SHOULDER) return null;
  const l = world[LM.LEFT_SHOULDER];
  const r = world[LM.RIGHT_SHOULDER];
  if ((l.visibility ?? 1) < MIN_SHOULDER_VISIBILITY && (r.visibility ?? 1) < MIN_SHOULDER_VISIBILITY) return null;
  return getBodyOrientation(l, r).orientation;
}

/**
 * Cerca de los umbrales (30° y 60° de giro) la vista cambia de un cuadro a otro. La
 * etiqueta solo cambia cuando la vista nueva se mantiene `VIEW_STABLE_MS`: sin parpadeo y
 * sin renders de React por cuadro. Recibe `t` del cuadro, no lee el reloj.
 */
export class ViewStabilizer {
  private shown: BodyOrientation | null = null;
  private candidate: BodyOrientation | null = null;
  private since = 0;

  update(view: BodyOrientation | null, t: number): BodyOrientation | null {
    if (view === this.shown) {
      this.candidate = this.shown;
      return this.shown;
    }
    if (view !== this.candidate) {
      this.candidate = view;
      this.since = t;
    } else if (t - this.since >= VIEW_STABLE_MS) {
      this.shown = view;
    }
    return this.shown;
  }

  reset(): void {
    this.shown = null;
    this.candidate = null;
    this.since = 0;
  }
}
