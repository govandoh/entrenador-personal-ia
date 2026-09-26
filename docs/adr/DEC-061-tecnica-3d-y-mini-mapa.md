# DEC-061 · Ficha de técnica con modelo 3D, mini mapa arrastrable y preferencias de vista

- **Estado:** Aceptada
- **Fecha:** 2026-09-24 (ajustes del 2026-09-26 tras los videos de referencia)
- **Decisores:** Equipo (pedido explícito del responsable del proyecto), Workstreams B, D y E
- **Etiquetas:** ui, 3d, entrenamiento

## Contexto y problema

El equipo pidió integrar en la app, "de manera orgánica y sin sobrecargar las vistas", lo que fitnetv2 mostraba en sus videos de demostración:

1. animación de 33 puntos en 3D que explique el ejercicio;
2. consejos y cómo hacerlo;
3. errores comunes;
4. respiración;
5. colocación del celular;
6. modelo 3D en tiempo real de la ejecución;
7. modelo que se pueda girar en todas direcciones;
8. controles para ocultar o mostrar los consejos y el modelo de ejemplo;
9. mover el mini mapa 3D mientras se entrena.

Las piezas ya existían por separado:
- las fichas de técnica de fitnetv2 (`DEC-043`);
- el visor con three.js (`DEC-039`);
- las demos 3D de `src/exercises/demoPoses.ts`.

Faltaba decidir dónde vive cada una sin tapar la cámara, cómo convive un segundo lienzo WebGL con el bucle de detección y dónde se guardan las preferencias de vista.

## Opciones consideradas

1. **Pantalla de tutorial aparte** antes de cada serie (como fitnetv2): mucho contenido de golpe y un paso más para entrenar.
2. **Todo en la preparación del entrenamiento**: tapa la cámara justo cuando el usuario se coloca.
3. **Ficha en hoja inferior + mini mapa flotante + consejos plegables** (elegida).

## Decisión

- **Ficha de técnica** (`src/ui/technique/TechniqueSheet.tsx`), en una hoja inferior que se abre desde "Ver técnica en 3D" (catálogo), desde cualquier ejercicio del programa y desde "Ver técnica" en la preparación. Contiene:
  - la demo 3D de 33 puntos en bucle con la fase y el ángulo que mide la app, que se oculta o se muestra;
  - la frase clave;
  - una sola sección visible a la vez, en pestañas: Pasos, Errores, Respiración y Celular (esta última solo en los ejercicios con asistente);
  - el aviso de seguridad y el descargo.

  Las fichas de los 60 ejercicios viven en `src/domain/tutorials.ts` (D), con `cameraSetup` para los siete con asistente.
- **Visor 3D** (`src/ui/components/Pose3DView.tsx`, siempre con `React.lazy`):
  - órbita con un dedo en todas direcciones (giro libre, inclinación de ±80°);
  - zoom con pellizco o rueda;
  - doble toque para volver a la vista inicial.

  Solo dibuja cuando algo cambió, lee los colores de los tokens y libera todos los recursos al desmontarse. La topología de huesos está copiada en `poseTopology.ts` para que la UI no importe MediaPipe.
- **Mini mapa 3D durante el entrenamiento** (`src/ui/workout/MiniMap3D.tsx`):
  - muestra por defecto el esqueleto en vivo (mundo 3D preparado en el motor 3D, crudo en 2D);
  - con el interruptor "Ejemplo" muestra la demo del ejercicio;
  - se gira dentro del panel y se arrastra por la barra;
  - al soltarlo se ancla al borde más cercano con la curva de cajón.

  Se alimenta cada 40 ms desde el bucle sin pasar por React. La posición se guarda como lado y altura relativa (`miniMapLayout.ts`, puro y con tests), dentro de las áreas seguras y siempre por encima de los controles de abajo (`data-minimap-floor`).
- **Consejos plegables** (`SetTips.tsx`) durante la serie: la frase clave, el error más común y la respiración, con un botón para cerrarlos.
- **Preferencias de vista** en el almacenamiento local (`fitnet_view_v1`): demo visible, mini mapa visible, consejos visibles y posición del mini mapa. Los botones de mini mapa y consejos van en la columna de herramientas del entrenamiento.
- La **demo de plancha** se añade a `demoPoses.ts` como postura sostenida. Queda fuera del k-NN de identificación porque por postura es igual a la parte alta de la flexión; la separa el `PlankTracker` por tiempo.
- `three` y `@types/three` entran como dependencias según `DEC-039`.

### Ajustes tras los videos de referencia (2026-09-26)

El equipo subió tres videos de fitnetv2 (`docs/academico/Video_1..3.mp4`, solo de consulta). Se adoptó lo que aportaban sin cambiar las pestañas: el equipo prefirió quedarse con ellas y no con la lista única del video, porque en pantallas pequeñas cuestan menos de leer.

- **Primera vez con cada ejercicio:** en la preparación la ficha se abre sola, con el aviso "Primera vez con este ejercicio" y las acciones "Cerrar" y "Entendido, empezar" fijas al pie de la hoja. Al cerrarla desde cualquier lugar (catálogo, programa o entrenamiento), el ejercicio queda en `seenTechnique` dentro de `fitnet_view_v1` y la ficha ya no se abre sola.
- **Ayuda durante la serie:** el botón "Técnica del ejercicio" (?) va en la barra superior en todas las fases, con la acción "Seguir con la serie". Mientras la ficha está abierta, el bucle no cuenta ni arranca la serie. La plancha no suma el hueco porque descarta los saltos entre cuadros.
- **Nivelado en el mini mapa:** muestra "Nivelado" o "Inclinado" según el acelerómetro, en todas las fases, y no aparece sin sensor. En la preparación del motor 3D muestra además "Párate derecho para calibrar".
- **Vista del cuerpo:** la barra superior muestra "Serie N · De frente / De perfil / En diagonal" según `getBodyOrientation`, con un estabilizador de 400 ms (`bodyView.ts`, puro y con tests) para que no parpadee cerca de los umbrales.
- **Colocación del mini mapa:** además del piso (`data-minimap-floor`), cada lado tiene un techo (`data-minimap-ceiling`). A la izquierda es el contador y a la derecha la columna de herramientas, y el panel se queda debajo si cabe. En pantallas de unos 568 px de alto no cabe y vuelve a la zona bajo la barra superior, por lo que puede tapar el contador (se arrastra o se oculta).

## Consecuencias

### Positivas

- Los nueve puntos del pedido quedan cubiertos sin pantallas nuevas ni pasos extra antes de entrenar.
- three.js va en un chunk aparte (unos 136 kB gz) que solo se descarga al abrir una ficha o el mini mapa; el shell sigue en unos 165 kB gz.
- `scripts/audit-responsive.cjs` cubre la ficha y los consejos, y el mini mapa cumple los objetivos táctiles en 320 px.

### Negativas

- Un segundo lienzo WebGL compite con MediaPipe por la GPU mientras se entrena. Se mitiga dibujando solo cuando cambia algo y cada 40 ms como mucho, y el mini mapa se puede ocultar. Falta medir los fps en celulares de gama baja.
- En el motor 2D el mini mapa muestra el mundo crudo de MediaPipe, sin nivelar.
- La ficha que se abre sola añade un paso la primera vez con cada ejercicio; a cambio se ve la técnica antes de la primera serie, como en fitnetv2.

## Referencias

- `DEC-039` (visor 3D), `DEC-043` (tutoriales), `DEC-058` (identidad y movimiento), `DEC-060` (responsive).
- `docs/DESIGN.md` §6 (catálogo de movimiento).
