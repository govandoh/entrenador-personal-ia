---
name: pr-ready
description: Preparar una rama para abrir PR: corre `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build`, revisa `git diff --stat`, verifica que si cambiaron `packages/contracts/**`, `models/manifest.json` o snapshots golden hay una DEC enlazada, y genera el cuerpo del PR con el checklist DoD de la plantilla. Úsala al terminar cualquier historia o fix, antes de `gh pr create`.
---

# /pr-ready — verificar la Definition of Done y armar el PR

## 1. Quality gates locales
Ejecutar en orden y detenerse en el primer fallo (mostrar solo el resumen del error):
```
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
Si el repo aún no tiene `pnpm`/`typecheck` (antes del PR 0 de tooling), usar `npm run lint`,
`npx tsc -b --noEmit` y `npm run build`, y decirlo en el reporte.

## 2. Revisar el alcance del diff
```
git fetch origin main
git diff --stat origin/main...HEAD
```
- ¿Menos de ~400 líneas? Si no, sugerir partir el PR.
- ¿Todos los archivos caen en un solo workstream? Si toca dos, avisar que necesitará dos revisores.
- ¿Hay archivos que no deberían estar (`dist/`, `.env`, `*.local`, binarios `.onnx`, capturas)?

## 3. Cambios protegidos → DEC obligatoria
Buscar en el diff rutas de:
- `packages/contracts/**` o `src/contracts/**`
- `models/manifest.json`
- `**/__snapshots__/**` o cualquier `*.snap` (golden)
Si hay alguna, exigir un `DEC-NNN` existente en `docs/adr/` y verificar que el archivo existe.
Sin DEC → **no listo**; sugerir `/adr`.

## 4. Verificaciones de DoD adicionales
- Tests nuevos para comportamiento nuevo (buscar `*.test.ts` en el diff).
- Si tocó `src/pose`, `src/ui`, `apps/web`, `packages/ui`: preguntar en qué celular se probó.
- Si tocó un paquete: ¿su `README.md` cambió o sigue siendo válido?
- `docs/STATUS.md`: recordar actualizarlo si el PR cierra un hito o un PR de la migración.
- Grep rápido de secretos: `sk-ant-`, `service_role`, `SUPABASE_SERVICE`, `eyJhbGci`.

## 5. Generar el cuerpo del PR
Rellenar `.github/PULL_REQUEST_TEMPLATE.md` con lo observado y guardarlo en el scratchpad
(`pr-body.md`) para `gh pr create --body-file`. Título en conventional commits, en español:
`feat(analysis-core): ...`, `fix(pose-engine): ...`, `chore(tooling): ...`, `docs(adr): ...`.

Marcar cada casilla del checklist según la evidencia real; las que no se pudieron verificar
quedan sin marcar con una nota.

## Salida esperada
```
## /pr-ready — <rama>
| Gate | Resultado |
|---|---|
| lint / typecheck / test / build | ✓ / ✗ (resumen) |
| Tamaño del diff | N archivos, +a/−b |
| Rutas protegidas | ninguna | DEC-NNN enlazada | FALTA DEC |
| Secretos | ninguno |
| Probado en celular | <modelo> / no aplica / PENDIENTE |
| docs/STATUS.md | actualizado / recordatorio |
Veredicto: LISTO | NO LISTO (motivos)
Cuerpo del PR: <ruta>/pr-body.md
Comando: gh pr create --base main --title "..." --body-file <ruta>/pr-body.md
```
