# DEC-019 · Plataforma de deploy: Vercel

- **Estado:** Aceptada
- **Fecha:** 2026-05-15
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** deploy, devex

## Contexto y problema

Cierra la decisión pendiente de sección 5.3 del anteproyecto (GitHub Pages vs. Vercel vs. Netlify). La app necesita deploy en URL pública para la entrega del 22/05.

## Opciones consideradas

1. **GitHub Pages** — requiere rama `gh-pages` o configurar Actions; no tiene preview deployments automáticos por PR; solo soporta sitios estáticos sin rewrite rules.
2. **Netlify** — similar a Vercel en features, interface menos familiar.
3. **Vercel** (elegida) — integración directa con GitHub, deploy automático en cada push a `main`, preview URL por rama, zero-config para proyectos Vite (detecta automáticamente el framework y usa `vite build`).

## Decisión

Vercel. El proyecto Vite se detecta automáticamente; no requiere `vercel.json` ni configuración adicional. El output directory `dist/` y el comando `vite build` son inferidos por Vercel. El plan Hobby (gratuito) es suficiente para el alcance del proyecto y no requiere tarjeta de crédito (cumple restricción dura 5).

## Consecuencias

### Positivas

- Cada push a `main` dispara un deploy automático.
- La URL de producción queda fija para incluir en los entregables del curso.
- Preview URL por rama sin configuración adicional.
- Zero-config: no requiere `vercel.json`; `dist/` y `vite build` son inferidos.
- El plan Hobby es gratuito y no requiere tarjeta de crédito (cumple restricción dura 5).

### Negativas

- Dependencia de un proveedor externo y de los límites del plan Hobby (gratuito).
- Cierra la decisión pendiente de sección 5.3 del anteproyecto, por lo que un cambio de plataforma requeriría una nueva DEC.

## Referencias

- `DEC-020` (HTTPS local; la URL de preview de Vercel es la alternativa para pruebas en iOS).
- `DEC-006` (PWA manual; el bump de versión del cache se realiza con cada deploy).
- Anteproyecto, sección 5.3 (GitHub Pages vs. Vercel vs. Netlify).
