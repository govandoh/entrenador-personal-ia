/**
 * Motor de análisis activo (ver DEC-057).
 *
 * Por defecto la app usa los contadores 2D de producción. Con `?engine=3d` en la URL usa
 * el motor 3D (`FramePipeline`: One Euro → nivelación → calibración → `Tracker3D`), para
 * probarlo en celular sin afectar a nadie más. Se evalúa una sola vez al cargar.
 */
export const ENGINE_3D: boolean = (() => {
  try {
    return new URLSearchParams(window.location.search).get('engine') === '3d';
  } catch {
    return false;
  }
})();
