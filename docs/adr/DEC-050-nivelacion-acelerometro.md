# DEC-050 · Nivelación con el acelerómetro y partes del cuerpo estimadas

- **Estado:** Aceptada en fitnetv2; rige en este repositorio a medida que se integra su código (`DEC-054`)
- **Integración:** paso I-1 (parte pura, `src/geometry/gravityAlign.ts`) e I-3 (listener y permiso de iOS)
- **Fecha:** 2026-09-23
- **Decisores:** equipo de fitnetv2 (mismo grupo del proyecto)
- **Etiquetas:** pose-engine, analysis-core
- **Origen:** `ecaldcc/07-FitNet`, `DECISIONS.md`, DEC-040 en la numeración de fitnetv2

> Importada desde fitnetv2 sin cambios de contenido. Las referencias a decisiones dentro del texto se renumeraron (DEC-026..043 de v2 → DEC-036..053 aquí; DEC-001..025 coinciden). Las rutas de archivo son las de fitnetv2; dónde vive cada pieza en este repositorio y qué cambió al integrarla se indica en "Notas de integración".

**Contexto:** En la primera prueba en celular, el usuario reportó que el modelo 3D lo mostraba inclinado entero, piernas incluidas, cuando solo se había inclinado de la cadera para arriba para tomar el teléfono.  
**Causa, primera parte:** Los `worldLandmarks` de MediaPipe están alineados con la cámara, no con el suelo. MediaPipe no tiene acceso a los sensores del teléfono, así que su "abajo" es el borde inferior de la imagen. Con el celular inclinado, el esqueleto entero aparece inclinado. No es solo visual: la inclinación del tronco en sentadilla, el arqueo en press y el balanceo del codo en curl se miden contra esa vertical falsa. El banco de pruebas confirma que con el celular inclinado 32° el press daba avisos de arqueo sin que existiera ninguno.  
**Causa, segunda parte:** Cuando una parte del cuerpo sale del cuadro, MediaPipe igual estima su posición, con baja visibilidad. El visor dibujaba esas partes igual que las vistas, y hacía creer que se estaban midiendo.  
**Alternativas consideradas:**  
(a) Estimar la vertical desde el cuerpo, asumiendo que las piernas están rectas — falla justo en la sentadilla, donde la cadera queda detrás de los tobillos.  
(b) Estimar el plano del suelo con los talones y las puntas de los pies — solo sirve con los pies en cuadro, que no es el caso en curl ni en press.  
(c) Ángulos de orientación del dispositivo (`deviceorientation`) — entran en bloqueo de cardán con el celular en vertical, que es justo como se usa la app, y no pueden leer una inclinación lateral tipo volante.  
(d) Vector de gravedad del acelerómetro (`devicemotion`).  
**Decisión:** Opción (d), en `src/pose/deviceGravity.ts`. La gravedad medida en ejes de pantalla se pasa a los ejes de la cámara, distintos para la trasera y la frontal, y el esqueleto se gira con la rotación mínima que lleva ese "abajo" al eje vertical. Se aplica una sola vez, después del filtro de DEC-046 y antes de los trackers y del visor. Los ángulos articulares no cambian; lo que se corrige son las medidas contra la vertical.  
**Signo de la lectura:** Android reporta la reacción del apoyo, que apunta hacia arriba, e iOS reporta la gravedad, hacia abajo. En lugar de detectar el navegador, se elige el signo que hace apuntar "abajo" hacia el borde inferior de la pantalla, lo cual siempre es cierto con el celular en vertical.  
**Salvaguardas:** Se descartan las lecturas con el teléfono en movimiento brusco y con el teléfono casi horizontal. Tampoco se corrigen inclinaciones de más de 60°. Sin sensor, la app mide como antes.  
**Permiso en iOS:** Safari exige pedirlo desde un toque, antes de cualquier espera. Se pide en el onboarding, antes que la cámara; al cerrar el tutorial en la vista de cámara; y con un botón "Nivelar" en el panel 3D si hace falta. En Android no requiere permiso. El panel muestra "Nivelado" cuando la corrección está activa.  
**Partes estimadas:** El visor dibuja tenues y sin articulaciones los huesos cuyos extremos tienen visibilidad menor a 0.5, el mismo umbral que usan los trackers.  
**Actualización 2026-09-23:** En la prueba siguiente el sensor funcionaba ("Nivelado") y el cuerpo seguía inclinado. La causa restante era un error de profundidad del modelo, que se corrige en DEC-053.  
**Verificado:** 13 pruebas nuevas en el banco. Recupera la vertical con inclinaciones de hasta 30° combinadas con giro, interpreta bien el signo de Android y de iPhone, y elimina los avisos falsos de arqueo en el press. **No verificado con sensores reales:** falta confirmar en un iPhone y en un Android que el signo y los ejes se comportan como en el modelo.

## Notas de integración

Al integrarse, el filtrado de lecturas pasó a `GravityEstimator.addSample(lectura, anguloPantalla, t)`, que recibe el tiempo en vez de llamar a `performance.now()`. `alignToGravityChecked` informa si la inclinación supera 60° en lugar de devolver el esqueleto sin corregir en silencio, para que la UI pida acomodar el teléfono. Sigue sin verificarse con sensores reales en iPhone y Android.
