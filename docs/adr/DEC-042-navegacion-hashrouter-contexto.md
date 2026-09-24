# DEC-042 · Navegación: HashRouter y contexto de React

- **Estado:** Aceptada en fitnetv2; rige en este repositorio a medida que se integra su código (`DEC-054`)
- **Integración:** paso I-4
- **Fecha:** 2026-09-19
- **Decisores:** equipo de fitnetv2 (mismo grupo del proyecto)
- **Etiquetas:** ui, dependencias
- **Origen:** `ecaldcc/07-FitNet`, `DECISIONS.md`, DEC-032 en la numeración de fitnetv2

> Importada desde fitnetv2 sin cambios de contenido. Las referencias a decisiones dentro del texto se renumeraron (DEC-026..043 de v2 → DEC-036..053 aquí; DEC-001..025 coinciden). Las rutas de archivo son las de fitnetv2; dónde vive cada pieza en este repositorio y qué cambió al integrarla se indica en "Notas de integración".

**Contexto:** La aplicación pasó de una sola pantalla de cámara a cinco vistas: inicio, rutinas, editor de rutina, entrenamiento y perfil. Hacía falta navegación y estado compartido.  
**Decisión de enrutado:** `HashRouter` de react-router-dom, no `BrowserRouter`.  
**Actualización 2026-09-23:** Se migró de `HashRouter` a `createHashRouter`, que mantiene el enrutado por fragmento pero habilita `useBlocker`. Ver DEC-052.  
**Razón:** Con rutas basadas en fragmento, el documento servido es siempre `index.html`. Eso evita depender de reglas de reescritura del hosting, que el proyecto no tiene configuradas, y mantiene la navegación funcionando con la PWA instalada y sin red. Con `BrowserRouter`, abrir directamente una ruta profunda devolvería 404 salvo que se agregue configuración en Vercel, y el service worker network-first de DEC-025 tendría que resolver el caso sin conexión.  
**Estructura de rutas:** La pantalla de entrenamiento queda fuera del contenedor con barra de navegación, porque ocupa todo el alto y no debe compartir espacio con la barra.  
**Decisión de estado:** Contexto de React, sin librería de estado. El árbol es chico y el dato cabe entero en memoria. Cada escritura persiste de inmediato en `localStorage`, por lo que no hay guardado explícito ni riesgo de perder cambios al cerrar la aplicación.  
**Registro de sesiones (corregido 2026-09-22):** La versión inicial de esta entrada afirmaba que la pantalla de cámara vivía fuera del proveedor de contexto, y releía el historial al recibir el evento `focus` de la ventana. Era falso: todas las rutas están dentro del proveedor, y la navegación interna no dispara `focus`, así que la pantalla de inicio no reflejaba lo entrenado hasta cambiar de ventana. Las pantallas de entrenamiento registran ahora la sesión con `recordSession` del contexto, que la guarda y actualiza el estado en el mismo instante. El contexto y el hook se separaron del componente proveedor para que la recarga en caliente de Vite funcione.  
**Acceso defensivo generalizado:** El criterio de DEC-024 se extiende a todo el proyecto en `src/storage/localStore.ts`, que además valida la forma del dato recuperado. Un JSON corrupto o de una versión anterior del esquema no debe propagarse al resto de la aplicación.

## Notas de integración

Cubre la dependencia `react-router-dom` (regla dura 9). Tensión con `ARCHITECTURE.md` §2.3, que prevé un store pequeño (`useWorkoutStore`) para el estado del entrenamiento: el contexto de React de v2 se conserva para rutinas y sesiones, y el store del entrenamiento se decide en el PR 5.
