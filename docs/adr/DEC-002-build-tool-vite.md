# DEC-002 · Build tool: Vite

- **Estado:** Aceptada
- **Fecha:** 2026-04-29
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** build

## Contexto y problema

Se necesita un bundler/dev server para el proyecto React.

## Opciones consideradas

1. **Vite** (elegida) — arranque en frío casi instantáneo, HMR nativo, estándar actual de la industria para proyectos React nuevos; el template `react-ts` genera una configuración limpia y minimal.
2. **Create React App (CRA)** — en modo mantenimiento y con ecosistema en declive.

## Decisión

CRA está en modo mantenimiento y su ecosistema está en declive. Vite ofrece arranque en frío casi instantáneo, HMR nativo, y es el estándar actual de la industria para proyectos React nuevos. El template `react-ts` de Vite genera una configuración limpia y minimal.

## Consecuencias

### Positivas

- Arranque en frío casi instantáneo y HMR nativo durante el desarrollo.
- Se adopta el estándar actual de la industria para proyectos React nuevos, evitando un bundler en modo mantenimiento con ecosistema en declive.
- El template `react-ts` genera una configuración limpia y minimal.

### Negativas

- La configuración minimal del template `react-ts` implica que cualquier necesidad adicional (por ejemplo, servir WASM o añadir PWA) debe resolverse de forma explícita (ver `DEC-005` y `DEC-006`).

## Referencias

- `DEC-001` (framework React sobre el que se monta el build).
- `DEC-003` (TypeScript, incluido en el template `react-ts`).
- `DEC-005` y `DEC-006` (decisiones condicionadas por la versión de Vite en uso).
