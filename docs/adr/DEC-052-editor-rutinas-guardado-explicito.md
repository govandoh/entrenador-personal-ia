# DEC-052 · Editor de rutinas con guardado explícito

- **Estado:** Aceptada en fitnetv2; rige en este repositorio a medida que se integra su código (`DEC-054`)
- **Integración:** paso I-4
- **Fecha:** 2026-09-23
- **Decisores:** equipo de fitnetv2 (mismo grupo del proyecto)
- **Etiquetas:** ui, dominio
- **Origen:** `ecaldcc/07-FitNet`, `DECISIONS.md`, DEC-042 en la numeración de fitnetv2

> Importada desde fitnetv2 sin cambios de contenido. Las referencias a decisiones dentro del texto se renumeraron (DEC-026..043 de v2 → DEC-036..053 aquí; DEC-001..025 coinciden). Las rutas de archivo son las de fitnetv2; dónde vive cada pieza en este repositorio y qué cambió al integrarla se indica en "Notas de integración".

**Contexto:** El usuario reportó que el editor de rutinas no tenía botón de guardar. Cada cambio se guardaba al instante, sin que el usuario lo supiera, y no había forma de arrepentirse. Crear una rutina además la guardaba vacía antes de agregarle nada.  
**Decisión:** El editor trabaja sobre un borrador, y solo "Crear rutina" o "Guardar cambios" lo persisten. Una barra fija abajo tiene "Cancelar" y la acción principal, siempre a la vista mientras se agregan ejercicios. Sin cambios, la acción principal dice "Listo". Crear una rutina ya no guarda nada hasta confirmar, y el nombre es obligatorio.  
**Salir con cambios pendientes:** Aparece una confirmación con "Guardar y salir", "Descartar" y "Seguir editando". Cubre el botón de volver, "Cancelar" y el gesto de volver de Android. Cerrar la pestaña con cambios pendientes también avisa.  
**Cambio de enrutador:** Para bloquear la navegación hace falta `useBlocker`, que solo existe con el enrutador de datos de React Router. Se migró de `HashRouter` a `createHashRouter`. El enrutado por fragmento de DEC-042 no cambia.  
**Editor a pantalla completa:** El editor sale del contenedor con barra de navegación, igual que las pantallas de entrenamiento. Dos barras apiladas abajo no dejan espacio en un celular, y editar es una tarea que se termina o se cancela.  
**Verificado en navegador:** Guardar sin nombre muestra el error. Cancelar con cambios pide confirmación, y "Seguir editando" conserva el borrador. Crear persiste la rutina y vuelve a la lista sin preguntar. El retroceso del historial queda bloqueado con cambios pendientes. Descartar no guarda nada.

## Notas de integración

Defectos a corregir al integrar: `loadRoutines` sobrescribe las rutinas guardadas con las plantillas si falla la validación, y `saveSession` relee `localStorage` y pierde el historial si el almacenamiento está bloqueado. Las mutaciones del borrador salen del componente a un módulo `editorOps`.
