# DEC-007 · Directorio de desarrollo: C:\Dev-AI (fuera de OneDrive)

- **Estado:** Aceptada
- **Fecha:** 2026-04-29
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** devex

## Contexto y problema

El proyecto estaba alojado dentro de la carpeta de OneDrive (`OneDrive - Universidad Mariano Gálvez\NOVENO SEMESTRE\INTELIGENCIA ARTIFICAL\Project-Training-AI\`). Al iniciar el servidor de desarrollo de Vite, se producía el error `EPERM -4048: operation not permitted, rmdir node_modules\.vite\deps` porque OneDrive bloqueaba archivos de `node_modules` durante la sincronización en tiempo real.

## Opciones consideradas

1. **Pausar OneDrive manualmente cada vez que se desarrolla.**
2. **Excluir `node_modules` de la sincronización vía atributos del sistema.**
3. **Mover el proyecto fuera de OneDrive** (elegida) — a `C:\Dev-AI`, ruta local sin sincronización en la nube.

## Decisión

OneDrive no es adecuado como entorno de desarrollo activo: sincroniza `node_modules` (>150 MB, miles de archivos pequeños), genera locks que rompen herramientas de build, y no agrega valor porque el versionado real se hará con Git/GitHub. `C:\Dev-AI` es una ruta local sin sincronización en la nube, limpia y sin espacios en el path. OneDrive queda para almacenar documentos y entregables del curso, no código fuente.

### Impacto

El `CLAUDE.md` se movió al interior de `entrenador-personal-ia\` (donde le corresponde según la estructura del proyecto). Las sesiones futuras de Claude Code deben iniciarse desde `C:\Dev-AI\entrenador-personal-ia`.

## Consecuencias

### Positivas

- Desaparece el error `EPERM -4048: operation not permitted, rmdir node_modules\.vite\deps` provocado por los locks de OneDrive sobre `node_modules`.
- Se evita sincronizar `node_modules` (>150 MB, miles de archivos pequeños) a la nube.
- El path de trabajo es local, limpio y sin espacios.
- OneDrive queda para documentos y entregables del curso; el versionado real del código se hace con Git/GitHub.

### Negativas

- El `CLAUDE.md` tuvo que moverse al interior de `entrenador-personal-ia\`.
- Las sesiones futuras de Claude Code deben iniciarse desde `C:\Dev-AI\entrenador-personal-ia`; abrir el proyecto desde la ruta antigua deja de ser válido.
- El código fuente ya no tiene la copia automática en la nube de OneDrive; su respaldo depende de Git/GitHub.

## Referencias

- `DEC-002` (servidor de desarrollo de Vite cuyo arranque fallaba dentro de OneDrive).
- `CLAUDE.md`
