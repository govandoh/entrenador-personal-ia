# -*- coding: utf-8 -*-
"""
Genera docs/academico/descripcion-proyecto.docx a partir del contenido del descriptor de proyecto.
Formato: manual técnico académico con estilos UMG.
Entregable histórico del MVP del curso IA26; ver docs/academico/README.md.
"""

from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import os

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'docs', 'academico', 'descripcion-proyecto.docx')

# ──────────────────────────────────────────────
# Helpers de formato
# ──────────────────────────────────────────────

def set_font(run, name='Times New Roman', size=12, bold=False, italic=False, color=None):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    if color:
        run.font.color.rgb = RGBColor(*color)

def set_paragraph_spacing(para, before=0, after=6, line_rule=WD_LINE_SPACING.ONE_POINT_FIVE):
    pf = para.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.line_spacing_rule = line_rule

def add_heading(doc, text, level=1):
    """Headings con estilos manuales para mayor control."""
    para = doc.add_paragraph()
    run = para.add_run(text)
    if level == 1:
        set_font(run, size=14, bold=True, color=(0, 51, 102))
        para.paragraph_format.space_before = Pt(18)
        para.paragraph_format.space_after = Pt(6)
    elif level == 2:
        set_font(run, size=13, bold=True, color=(0, 70, 127))
        para.paragraph_format.space_before = Pt(14)
        para.paragraph_format.space_after = Pt(4)
    elif level == 3:
        set_font(run, size=12, bold=True, italic=True, color=(40, 40, 40))
        para.paragraph_format.space_before = Pt(10)
        para.paragraph_format.space_after = Pt(3)
    # Línea separadora bajo heading nivel 1
    if level == 1:
        add_bottom_border(para)
    return para

def add_bottom_border(para):
    pPr = para._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '4')
    bottom.set(qn('w:space'), '1')
    bottom.set(qn('w:color'), '003366')
    pBdr.append(bottom)
    pPr.append(pBdr)

def add_body(doc, text, indent=False):
    para = doc.add_paragraph()
    run = para.add_run(text)
    set_font(run, size=11)
    set_paragraph_spacing(para, before=0, after=6)
    if indent:
        para.paragraph_format.left_indent = Cm(0.5)
    para.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    return para

def add_body_mixed(doc, segments, indent=False):
    """
    segments: lista de (texto, bold, italic)
    Permite párrafos con mezcla de estilos inline.
    """
    para = doc.add_paragraph()
    for text, bold, italic in segments:
        run = para.add_run(text)
        set_font(run, size=11, bold=bold, italic=italic)
    set_paragraph_spacing(para, before=0, after=6)
    if indent:
        para.paragraph_format.left_indent = Cm(0.5)
    para.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    return para

def add_bullet(doc, text, level=0):
    para = doc.add_paragraph(style='List Bullet')
    run = para.add_run(text)
    set_font(run, size=11)
    para.paragraph_format.left_indent = Cm(1.0 + level * 0.5)
    para.paragraph_format.space_after = Pt(3)
    return para

def add_numbered(doc, text, num):
    para = doc.add_paragraph()
    run_num = para.add_run(f'{num}. ')
    set_font(run_num, size=11, bold=True)
    run_text = para.add_run(text)
    set_font(run_text, size=11)
    para.paragraph_format.left_indent = Cm(0.5)
    para.paragraph_format.space_after = Pt(4)
    para.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    return para

def add_code_block(doc, code_text):
    """Bloque de código con fondo gris simulado via sombreado."""
    para = doc.add_paragraph()
    run = para.add_run(code_text)
    run.font.name = 'Courier New'
    run.font.size = Pt(9)
    pPr = para._p.get_or_add_pPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), 'F2F2F2')
    pPr.append(shd)
    para.paragraph_format.left_indent = Cm(0.5)
    para.paragraph_format.right_indent = Cm(0.5)
    para.paragraph_format.space_before = Pt(4)
    para.paragraph_format.space_after = Pt(4)
    return para

def add_formula(doc, formula_text):
    para = doc.add_paragraph()
    para.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = para.add_run(formula_text)
    run.font.name = 'Cambria Math'
    run.font.size = Pt(11)
    run.font.italic = True
    set_paragraph_spacing(para, before=4, after=4)
    return para

def set_table_style(table):
    table.style = 'Table Grid'
    for row in table.rows:
        for cell in row.cells:
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            for para in cell.paragraphs:
                for run in para.runs:
                    run.font.name = 'Times New Roman'
                    run.font.size = Pt(10)
                para.paragraph_format.space_after = Pt(2)
                para.paragraph_format.space_before = Pt(2)

def style_header_row(table, row_idx=0):
    for cell in table.rows[row_idx].cells:
        for para in cell.paragraphs:
            for run in para.runs:
                run.font.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
        tc = cell._tc
        tcPr = tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd')
        shd.set(qn('w:val'), 'clear')
        shd.set(qn('w:color'), 'auto')
        shd.set(qn('w:fill'), '003366')
        tcPr.append(shd)

def add_page_break(doc):
    para = doc.add_paragraph()
    run = para.add_run()
    run.add_break(docx_break_type())
    para.paragraph_format.space_after = Pt(0)

def docx_break_type():
    from docx.oxml.ns import qn as _qn
    from docx.oxml import OxmlElement as _OE
    br = _OE('w:br')
    br.set(_qn('w:type'), 'page')
    return br

def insert_page_break(doc):
    doc.add_page_break()

def add_footnote_style_ref(doc, text):
    para = doc.add_paragraph()
    run = para.add_run(text)
    set_font(run, size=10)
    para.paragraph_format.left_indent = Cm(0.5)
    para.paragraph_format.space_after = Pt(3)
    para.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    return para

def set_page_margins(doc):
    for section in doc.sections:
        section.top_margin = Cm(2.5)
        section.bottom_margin = Cm(2.5)
        section.left_margin = Cm(3.0)
        section.right_margin = Cm(2.5)

def add_page_numbers(doc):
    """Inserta número de página centrado en el pie de página."""
    for section in doc.sections:
        footer = section.footer
        para = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
        para.clear()
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = para.add_run()
        fldChar1 = OxmlElement('w:fldChar')
        fldChar1.set(qn('w:fldCharType'), 'begin')
        instrText = OxmlElement('w:instrText')
        instrText.text = ' PAGE '
        fldChar2 = OxmlElement('w:fldChar')
        fldChar2.set(qn('w:fldCharType'), 'end')
        run._r.append(fldChar1)
        run._r.append(instrText)
        run._r.append(fldChar2)
        run.font.name = 'Times New Roman'
        run.font.size = Pt(10)

# ──────────────────────────────────────────────
# Construcción del documento
# ──────────────────────────────────────────────

doc = Document()
set_page_margins(doc)
add_page_numbers(doc)

# ── PORTADA ──────────────────────────────────
doc.add_paragraph()  # espacio superior

p_univ = doc.add_paragraph()
p_univ.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p_univ.add_run('UNIVERSIDAD MARIANO GÁLVEZ DE GUATEMALA')
set_font(r, size=14, bold=True, color=(0, 51, 102))

p_fac = doc.add_paragraph()
p_fac.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p_fac.add_run('Facultad de Ingeniería en Sistemas de Información')
set_font(r, size=12, bold=False)

p_curso = doc.add_paragraph()
p_curso.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p_curso.add_run('Inteligencia Artificial — IA26')
set_font(r, size=12)

doc.add_paragraph()
doc.add_paragraph()
doc.add_paragraph()

p_title = doc.add_paragraph()
p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p_title.add_run('ENTRENADOR PERSONAL CON ESTIMACIÓN DE POSES EN TIEMPO REAL')
set_font(r, size=18, bold=True, color=(0, 51, 102))

doc.add_paragraph()

p_sub = doc.add_paragraph()
p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p_sub.add_run('Descripción Técnica del Proyecto')
set_font(r, size=14, italic=True)

doc.add_paragraph()
doc.add_paragraph()
doc.add_paragraph()

# Tabla de integrantes
tbl = doc.add_table(rows=6, cols=2)
tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
tbl.style = 'Table Grid'
header_data = [('Integrante', 'Nombre completo')]
rows_data = [
    ('Integrante 1', '___________________________________'),
    ('Integrante 2', '___________________________________'),
    ('Integrante 3', '___________________________________'),
    ('Integrante 4', '___________________________________'),
    ('Integrante 5', '___________________________________'),
]
for i, (col1, col2) in enumerate([header_data[0]] + rows_data):
    row = tbl.rows[i]
    c1 = row.cells[0]
    c2 = row.cells[1]
    p1 = c1.paragraphs[0]
    p2 = c2.paragraphs[0]
    r1 = p1.add_run(col1)
    r2 = p2.add_run(col2)
    bold = (i == 0)
    set_font(r1, size=11, bold=bold)
    set_font(r2, size=11, bold=bold)
    p1.paragraph_format.space_after = Pt(3)
    p2.paragraph_format.space_after = Pt(3)
    if i == 0:
        for cell in row.cells:
            tc = cell._tc
            tcPr = tc.get_or_add_tcPr()
            shd = OxmlElement('w:shd')
            shd.set(qn('w:val'), 'clear')
            shd.set(qn('w:color'), 'auto')
            shd.set(qn('w:fill'), 'D6E4F0')
            tcPr.append(shd)

doc.add_paragraph()

for label, value in [
    ('Fecha de entrega:', '22 de mayo de 2026'),
    ('URL de la aplicación:', '(enlace de Vercel)'),
    ('Repositorio:', '(enlace de GitHub)'),
]:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_lbl = p.add_run(f'{label} ')
    set_font(r_lbl, size=11, bold=True)
    r_val = p.add_run(value)
    set_font(r_val, size=11)
    p.paragraph_format.space_after = Pt(3)

insert_page_break(doc)

# ── ÍNDICE (estático) ────────────────────────
add_heading(doc, 'Contenido', level=1)
toc_entries = [
    ('1.', 'Resumen ejecutivo'),
    ('2.', 'Introducción'),
    ('3.', 'Objetivos'),
    ('   3.1', 'Objetivo general'),
    ('   3.2', 'Objetivos específicos'),
    ('4.', 'Marco teórico'),
    ('   4.1', 'Estimación de poses humanas'),
    ('   4.2', 'MediaPipe Pose Landmarker'),
    ('   4.3', 'Aplicaciones web progresivas (PWA)'),
    ('5.', 'Arquitectura del sistema'),
    ('   5.1', 'Visión general'),
    ('   5.2', 'Pipeline de detección'),
    ('   5.3', 'Cálculo de ángulos articulares'),
    ('   5.4', 'Máquinas de estados y conteo de repeticiones'),
    ('   5.5', 'Sistema de retroalimentación'),
    ('6.', 'Ejercicios implementados'),
    ('   6.1', 'Sentadilla (Squat)'),
    ('   6.2', 'Curl de bíceps (Bicep Curl)'),
    ('   6.3', 'Press de hombro (Shoulder Press)'),
    ('7.', 'Stack tecnológico'),
    ('8.', 'Decisiones de diseño relevantes'),
    ('9.', 'Resultados'),
    ('10.', 'Limitaciones conocidas'),
    ('11.', 'Conclusiones'),
    ('12.', 'Referencias'),
]
for num, title in toc_entries:
    p = doc.add_paragraph()
    r_num = p.add_run(f'{num}  ')
    r_tit = p.add_run(title)
    is_main = not num.startswith(' ')
    set_font(r_num, size=11, bold=is_main)
    set_font(r_tit, size=11, bold=is_main)
    p.paragraph_format.left_indent = Cm(0 if is_main else 0.8)
    p.paragraph_format.space_after = Pt(2)

insert_page_break(doc)

# ── 1. RESUMEN EJECUTIVO ─────────────────────
add_heading(doc, '1. Resumen ejecutivo', level=1)
add_body(doc,
    'Se desarrolló una aplicación web progresiva (PWA) que actúa como entrenador personal de ejercicios físicos '
    'utilizando visión por computadora en tiempo real. La aplicación accede a la cámara del dispositivo móvil del '
    'usuario, detecta su postura corporal mediante el modelo pre-entrenado MediaPipe Pose Landmarker de Google, y '
    'calcula ángulos articulares para determinar la calidad de ejecución de tres ejercicios: sentadilla, curl de '
    'bíceps y press de hombro. El sistema contabiliza repeticiones automáticamente, proporciona retroalimentación '
    'visual codificada por colores y emite instrucciones de voz en tiempo real, todo sin necesidad de conexión a '
    'un servidor externo ni de ningún costo económico.'
)
add_body(doc,
    'El componente de inteligencia artificial del proyecto reside en la inferencia con un modelo de red neuronal '
    'profunda que estima la posición de 33 puntos corporales a partir de cada fotograma de video, combinado con '
    'máquinas de estados basadas en reglas angulares clínicamente fundamentadas para evaluar la calidad del movimiento.'
)

# ── 2. INTRODUCCIÓN ──────────────────────────
add_heading(doc, '2. Introducción', level=1)
add_body(doc,
    'El sedentarismo y la falta de acceso a orientación profesional en el ejercicio físico son problemas de salud '
    'pública documentados en toda Latinoamérica. Las soluciones comerciales existentes —aplicaciones con '
    'entrenadores virtuales o dispositivos portátiles con sensores inerciales— presentan barreras económicas '
    'significativas para una gran parte de la población.'
)
add_body(doc,
    'Este proyecto busca demostrar que la visión por computadora, combinada con los recursos gratuitos disponibles '
    'hoy en la web, puede democratizar el acceso a retroalimentación técnica de calidad durante el ejercicio. Un '
    'teléfono inteligente con navegador moderno es suficiente para ejecutar la inferencia de un modelo de estimación '
    'de poses sin necesidad de hardware especializado, conexión permanente a internet ni cuentas de pago.'
)
add_body(doc,
    'Desde la perspectiva académica, el proyecto ilustra una aplicación concreta del área de análisis de imágenes '
    'dentro de la inteligencia artificial: el modelo de MediaPipe Pose es el producto de entrenamiento supervisado '
    'sobre millones de imágenes anotadas, y la aplicación consume ese modelo para resolver un problema de dominio real.'
)

# ── 3. OBJETIVOS ─────────────────────────────
add_heading(doc, '3. Objetivos', level=1)
add_heading(doc, '3.1 Objetivo general', level=2)
add_body(doc,
    'Desarrollar una aplicación web progresiva que utilice estimación de poses en tiempo real para guiar y evaluar '
    'la ejecución técnica de ejercicios físicos desde un dispositivo móvil, sin costo económico para el usuario ni '
    'infraestructura de servidor.'
)
add_heading(doc, '3.2 Objetivos específicos', level=2)
obj_esp = [
    'Integrar el modelo MediaPipe Pose Landmarker en un pipeline de procesamiento de video en tiempo real con '
    'latencia perceptualmente nula para el usuario.',
    'Implementar máquinas de estados basadas en ángulos articulares para tres ejercicios: sentadilla, curl de '
    'bíceps y press de hombro.',
    'Diseñar un sistema de retroalimentación multimodal (visual y auditivo) que comunique la calidad de ejecución '
    'sin interrumpir el flujo del ejercicio.',
    'Empaquetar la aplicación como PWA instalable en dispositivos Android e iOS.',
    'Publicar la aplicación en una URL pública de acceso gratuito.',
]
for i, obj in enumerate(obj_esp, 1):
    add_numbered(doc, obj, i)

# ── 4. MARCO TEÓRICO ─────────────────────────
add_heading(doc, '4. Marco teórico', level=1)

add_heading(doc, '4.1 Estimación de poses humanas', level=2)
add_body(doc,
    'La estimación de poses humanas (human pose estimation) es una tarea de visión por computadora que consiste en '
    'localizar, en una imagen o fotograma de video, los puntos clave del esqueleto humano —articulaciones como '
    'hombros, codos, rodillas y caderas— para inferir la postura del cuerpo. Las redes neuronales convolucionales '
    '(CNN) entrenadas sobre grandes conjuntos de datos anotados han alcanzado precisión suficiente para ejecutarse '
    'en tiempo real, incluso en hardware de consumo, a partir de mediados de la década de 2010.'
)
add_body(doc,
    'Los modelos actuales de detección de una sola persona (single-person) son especialmente eficientes porque '
    'evitan el costo computacional de la detección de múltiples personas, lo que los hace adecuados para '
    'aplicaciones de fitness donde el contexto garantiza un único sujeto en escena.'
)

add_heading(doc, '4.2 MediaPipe Pose Landmarker', level=2)
add_body(doc,
    'MediaPipe es una plataforma de soluciones de visión por computadora desarrollada por Google. El modelo '
    'Pose Landmarker detecta 33 puntos corporales en cada fotograma, cada uno con coordenadas normalizadas '
    '(x, y ∈ [0,1]) relativas al tamaño de la imagen, coordenada de profundidad relativa (z) y un indicador '
    'de visibilidad (v ∈ [0,1]).'
)
add_body(doc,
    'Este proyecto utiliza la variante Lite del modelo, optimizada para velocidad con una leve reducción de '
    'precisión respecto a la variante Full, lo que resulta adecuado para un entorno móvil donde la potencia de '
    'cómputo es limitada y la latencia es crítica para la experiencia de usuario.'
)
add_body(doc,
    'La API utilizada es @mediapipe/tasks-vision (Tasks API, versión 0.10.35), la interfaz moderna y unificada '
    'de MediaPipe para JavaScript, que reemplaza a la API legacy y ofrece un modo de ejecución VIDEO diseñado '
    'específicamente para el patrón requestAnimationFrame.'
)

add_heading(doc, '4.3 Aplicaciones web progresivas (PWA)', level=2)
add_body(doc,
    'Una Aplicación Web Progresiva es una aplicación web que adopta un conjunto de tecnologías del navegador '
    '—principalmente el Service Worker y el Web App Manifest— para comportarse como una aplicación nativa '
    'instalable. Las PWA pueden ejecutarse sin conexión (o con conectividad limitada), aparecer en la pantalla '
    'de inicio del dispositivo como cualquier otra aplicación, y eliminar la barra de navegación del navegador '
    'para ofrecer una experiencia de pantalla completa.'
)
add_body(doc,
    'Para una aplicación de fitness como la desarrollada, el modelo PWA es ideal: el usuario instala la '
    'aplicación una sola vez y accede a ella directamente desde su pantalla de inicio sin fricciones de '
    'apertura de navegador.'
)

# ── 5. ARQUITECTURA ──────────────────────────
add_heading(doc, '5. Arquitectura del sistema', level=1)

add_heading(doc, '5.1 Visión general', level=2)
add_body(doc,
    'La aplicación es completamente del lado del cliente (client-side only). No existe servidor de aplicación: '
    'toda la lógica de detección, cálculo y retroalimentación ocurre en el procesador del dispositivo del usuario. '
    'El diagrama de flujo de datos es el siguiente:'
)
add_code_block(doc,
    'Cámara del dispositivo (getUserMedia)\n'
    '          │\n'
    '          ▼\n'
    '    Elemento <video> en memoria\n'
    '          │\n'
    '          ├──────────────────────────────────────────┐\n'
    '          │                                           │\n'
    '          ▼                                           ▼\n'
    '  MediaPipe PoseLandmarker                    Canvas <canvas>\n'
    '  detectForVideo(video, timestamp)            DrawingUtils.drawConnectors()\n'
    '          │                                   DrawingUtils.drawLandmarks()\n'
    '          ▼\n'
    '  landmarks[33]  (x, y, z, visibilidad)\n'
    '          │\n'
    '          ▼\n'
    '  geometry/angles.ts\n'
    '  calculateAngle(A, B, C)  →  ángulo en grados\n'
    '          │\n'
    '          ▼\n'
    '  exercises/squat.ts  |  bicepCurl.ts  |  shoulderPress.ts\n'
    '  máquina de estados  →  { phase, reps, feedbackLevel, feedbackMessage }\n'
    '          │\n'
    '          ├──────────────────────┬───────────────────────────┐\n'
    '          ▼                      ▼                           ▼\n'
    '  ExerciseOverlay            useSpeech()              CameraView (React)\n'
    '  (barra visual, colores)    (Web Speech API)         (estado de UI)'
)
add_body(doc,
    'Este diseño garantiza que la aplicación funcione sin conexión a internet una vez que el modelo de MediaPipe '
    'ha sido descargado y cacheado por el Service Worker y el caché HTTP del navegador.'
)

add_heading(doc, '5.2 Pipeline de detección', level=2)
add_body(doc,
    'En cada iteración del bucle de animación (típicamente 30-60 fotogramas por segundo), CameraView ejecuta la '
    'función detectAndDraw() pasando el fotograma actual del elemento <video> y una marca de tiempo en '
    'milisegundos. MediaPipe ejecuta la inferencia del modelo y devuelve el arreglo de 33 landmarks. '
    'Simultáneamente, DrawingUtils dibuja el esqueleto (conectores en verde, landmarks en rojo) sobre el canvas '
    'superpuesto al video.'
)
add_body(doc,
    'Los landmarks se pasan inmediatamente al tracker del ejercicio activo, que calcula los ángulos articulares '
    'relevantes y determina la fase del movimiento, el conteo de repeticiones y el nivel de retroalimentación.'
)

add_heading(doc, '5.3 Cálculo de ángulos articulares', level=2)
add_body(doc,
    'Para cada articulación de interés se identifican tres landmarks: el punto proximal (A), el vértice de la '
    'articulación (B) y el punto distal (C). El ángulo en B se calcula mediante la función calculateAngle '
    'implementada en src/geometry/angles.ts:'
)
add_formula(doc, 'ángulo = | atan2(Cy − By, Cx − Bx) − atan2(Ay − By, Ax − Bx) | × (180 / π)')
add_formula(doc, 'si ángulo > 180°  →  ángulo = 360° − ángulo')
add_body(doc,
    'El uso de Math.atan2 (en lugar de la ley de cosenos) evita divisiones por cero cuando dos puntos son '
    'colineales y maneja correctamente todos los cuadrantes del plano. El rango de salida es siempre 0°–180°.'
)

add_heading(doc, '5.4 Máquinas de estados y conteo de repeticiones', level=2)
add_body(doc,
    'Cada ejercicio implementa una máquina de estados determinista que modela las fases del movimiento. La '
    'transición entre fases utiliza histéresis de umbral doble: existen umbrales distintos para entrar y para '
    'salir de cada fase, creando una zona muerta que absorbe el ruido de los landmarks y elimina la oscilación '
    '(flutter) sin introducir latencia artificial.'
)
add_body(doc,
    'El conteo de repeticiones no ocurre únicamente en la transición de fase, sino que requiere la confirmación '
    'previa de que el movimiento alcanzó su punto extremo (máximo o mínimo de ángulo, según el ejercicio). Este '
    'gate de confirmación se implementa mediante un contador de fotogramas consecutivos con tendencia sostenida, '
    'descartando spikes de ruido que no representen movimiento intencional.'
)

add_heading(doc, '5.5 Sistema de retroalimentación', level=2)
add_body(doc, 'El sistema ofrece dos canales simultáneos de retroalimentación:')
add_body_mixed(doc, [
    ('Visual: ', True, False),
    ('Una barra fija en la parte inferior de la pantalla muestra el mensaje de feedback y el contador de '
     'repeticiones. Un borde izquierdo colorido codifica semánticamente el nivel de calidad: verde (buena forma), '
     'amarillo (forma mejorable) y rojo (posición de riesgo). La opacidad del fondo (80 %) y el filtro de '
     'desenfoque (backdrop-filter: blur) garantizan legibilidad sobre cualquier fondo de video.', False, False),
])
add_body_mixed(doc, [
    ('Auditivo: ', True, False),
    ('La API nativa SpeechSynthesis del navegador emite instrucciones en español (es-ES) en los momentos clave '
     'del movimiento: al detectar el punto extremo del recorrido y al completar una repetición. El sistema combina '
     'ambos mensajes en una única locución para evitar colisiones de audio. El primer uso de la API de voz requiere '
     'un gesto del usuario (el botón "Comenzar a entrenar" del onboarding actúa como ese gesto de desbloqueo, '
     'cumpliendo el requisito de iOS Safari).', False, False),
])

# ── 6. EJERCICIOS ────────────────────────────
add_heading(doc, '6. Ejercicios implementados', level=1)

add_heading(doc, '6.1 Sentadilla (Squat)', level=2)
add_body(doc,
    'Landmarks utilizados: Caderas (23, 24), rodillas (25, 26) y tobillos (27, 28). '
    'Ángulo primario: Promedio del ángulo de ambas rodillas (cadera–rodilla–tobillo).'
)
t = doc.add_table(rows=4, cols=3)
t.style = 'Table Grid'
headers = ['Umbral', 'Valor', 'Significado']
data = [
    ('STANDING_ANGLE', '160°', 'Pierna extendida → fase "de pie"'),
    ('BOTTOM_ANGLE', '100°', 'Rodilla muy flexionada → fase "abajo"'),
    ('GOOD_DEPTH_ANGLE', '90°', 'Profundidad óptima (muslos paralelos al suelo)'),
]
for j, h in enumerate(headers):
    cell = t.rows[0].cells[j]
    r = cell.paragraphs[0].add_run(h)
    set_font(r, size=10, bold=True, color=(255, 255, 255))
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), '003366')
    tcPr.append(shd)
for i, (a, b, c) in enumerate(data, 1):
    for j, val in enumerate([a, b, c]):
        cell = t.rows[i].cells[j]
        r = cell.paragraphs[0].add_run(val)
        set_font(r, size=10)
        cell.paragraphs[0].paragraph_format.space_after = Pt(2)
doc.add_paragraph().paragraph_format.space_after = Pt(4)

add_body_mixed(doc, [('Conteo: ', True, False),
    ('La repetición se contabiliza en la transición abajo → de pie, únicamente si previamente se confirmó el '
     'fondo real del movimiento (inversión de tendencia de más de 2° sostenida un fotograma).', False, False)])
add_body_mixed(doc, [('Retroalimentación:', True, False)])
add_bullet(doc, 'Ángulo de rodilla ≤ 90°: "¡Excelente profundidad!" (verde)')
add_bullet(doc, '90°–100°: "Baja un poco más" (amarillo)')
add_bullet(doc, 'Posición de pie: "Listo — baja para la sentadilla" (idle)')

add_heading(doc, '6.2 Curl de bíceps (Bicep Curl)', level=2)
add_body(doc,
    'Landmarks utilizados: Hombros (11, 12), codos (13, 14) y muñecas (15, 16). '
    'Detección automática de vista: Si la diferencia de visibilidad entre ambos brazos supera 0.35, la aplicación '
    'infiere vista lateral y trabaja únicamente con el brazo más visible; de lo contrario, procesa ambos brazos en paralelo.'
)
t2 = doc.add_table(rows=4, cols=3)
t2.style = 'Table Grid'
data2 = [
    ('EXTENDED_ANGLE', '160°', 'Brazo extendido → fase "extendido"'),
    ('FLEXED_ANGLE', '60°', 'Codo muy flexionado → fase "contraído"'),
    ('GOOD_FORM_ANGLE', '50°', 'Contracción completa'),
]
for j, h in enumerate(headers):
    cell = t2.rows[0].cells[j]
    r = cell.paragraphs[0].add_run(h)
    set_font(r, size=10, bold=True, color=(255, 255, 255))
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), '003366')
    tcPr.append(shd)
for i, (a, b, c) in enumerate(data2, 1):
    for j, val in enumerate([a, b, c]):
        cell = t2.rows[i].cells[j]
        r = cell.paragraphs[0].add_run(val)
        set_font(r, size=10)
        cell.paragraphs[0].paragraph_format.space_after = Pt(2)
doc.add_paragraph().paragraph_format.space_after = Pt(4)

add_body_mixed(doc, [('Arquitectura interna: ', True, False),
    ('La clase ArmTracker encapsula la lógica de un solo brazo. BicepCurlTracker instancia dos ArmTracker y '
     'unifica el conteo con lógica OR y un cooldown de 15 fotogramas (~250 ms a 60 fps) para manejar '
     'correctamente curls bilaterales (barra o mancuernas simultáneas) y alternos (mancuernas alternas).', False, False)])
add_body_mixed(doc, [('Conteo: ', True, False),
    ('Una repetición se registra cuando cualquiera de los dos brazos completa su ciclo extendido → contraído → '
     'extendido, con la confirmación previa de que el ángulo mínimo fue alcanzado (cima confirmada por 3 fotogramas '
     'consecutivos de tendencia ascendente).', False, False)])

add_heading(doc, '6.3 Press de hombro (Shoulder Press)', level=2)
add_body(doc,
    'Landmarks utilizados: Idénticos al curl de bíceps (hombros, codos, muñecas). '
    'Polaridad invertida: A diferencia del curl —donde el esfuerzo reduce el ángulo del codo— en el press el '
    'esfuerzo lo aumenta (las pesas suben overhead y el codo se extiende). El ángulo primario es '
    'Math.max(ángulo_izquierdo, ángulo_derecho), capturando el brazo más extendido como indicador de calidad.'
)
t3 = doc.add_table(rows=5, cols=3)
t3.style = 'Table Grid'
h3 = ['Umbral', 'Valor', 'Justificación']
data3 = [
    ('PRESSED_ANGLE', '150°', 'Pesas overhead → fase "presionado"'),
    ('LOWERED_ANGLE', '100°', 'Pesas a nivel de hombro → fase "abajo"'),
    ('GOOD_LOCKOUT_ANGLE', '145°', 'Extensión completa sin hiperextensión'),
    ('SAFE_LOW_ANGLE', '80°', 'Límite clínico — evitar síndrome de impingement del supraespinoso'),
]
for j, h in enumerate(h3):
    cell = t3.rows[0].cells[j]
    r = cell.paragraphs[0].add_run(h)
    set_font(r, size=10, bold=True, color=(255, 255, 255))
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), '003366')
    tcPr.append(shd)
for i, (a, b, c) in enumerate(data3, 1):
    for j, val in enumerate([a, b, c]):
        cell = t3.rows[i].cells[j]
        r = cell.paragraphs[0].add_run(val)
        set_font(r, size=10)
        cell.paragraphs[0].paragraph_format.space_after = Pt(2)
doc.add_paragraph().paragraph_format.space_after = Pt(4)

add_body(doc,
    'El límite de SAFE_LOW_ANGLE = 80° está fundamentado en la biomecánica del hombro: bajar los codos por '
    'debajo de la línea del hombro con carga externa comprime el tendón supraespinoso entre el acromion y la '
    'cabeza humeral. La retroalimentación roja alerta al usuario antes de que el movimiento alcance el rango de riesgo.'
)

# ── 7. STACK TECNOLÓGICO ─────────────────────
add_heading(doc, '7. Stack tecnológico', level=1)
t4 = doc.add_table(rows=12, cols=3)
t4.style = 'Table Grid'
stack_headers = ['Capa', 'Tecnología', 'Versión']
stack_data = [
    ('Detección de poses', 'MediaPipe Pose Landmarker (variante Lite)', '0.10.35'),
    ('WASM runtime', 'jsDelivr CDN', '@0.10.35/wasm'),
    ('Framework UI', 'React', '19.2.5'),
    ('Lenguaje', 'TypeScript', '6.0.2'),
    ('Build tool', 'Vite', '8.0.10'),
    ('Cámara', 'getUserMedia (API nativa del navegador)', '—'),
    ('Renderizado de esqueleto', 'HTML5 Canvas API + DrawingUtils', '—'),
    ('Feedback de voz', 'Web Speech API (SpeechSynthesis)', '—'),
    ('PWA', 'Service Worker manual + Web App Manifest', '—'),
    ('Deploy', 'Vercel (plan Hobby gratuito)', '—'),
    ('HTTPS local', '@vitejs/plugin-basic-ssl', '2.3.0'),
]
for j, h in enumerate(stack_headers):
    cell = t4.rows[0].cells[j]
    r = cell.paragraphs[0].add_run(h)
    set_font(r, size=10, bold=True, color=(255, 255, 255))
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), '003366')
    tcPr.append(shd)
for i, (a, b, c) in enumerate(stack_data, 1):
    for j, val in enumerate([a, b, c]):
        cell = t4.rows[i].cells[j]
        r = cell.paragraphs[0].add_run(val)
        set_font(r, size=10)
        cell.paragraphs[0].paragraph_format.space_after = Pt(2)
doc.add_paragraph().paragraph_format.space_after = Pt(4)

add_body(doc,
    'La decisión de no utilizar librerías adicionales de gestión de estado (Redux, Zustand) ni de animación '
    '(Framer Motion) fue deliberada: el estado de la aplicación es lo suficientemente simple como para manejarse '
    'con los hooks nativos de React (useState, useRef, useEffect), y cualquier dependencia adicional aumenta el '
    'tamaño del bundle que el usuario debe descargar en su primera visita.'
)

# ── 8. DECISIONES DE DISEÑO ──────────────────
add_heading(doc, '8. Decisiones de diseño relevantes', level=1)

add_heading(doc, '8.1 Sin servidor', level=2)
add_body(doc,
    'Todo el procesamiento ocurre en el dispositivo del usuario. Esto elimina los costos de infraestructura, '
    'protege la privacidad del usuario (el video de la cámara nunca sale del dispositivo) y hace que la '
    'aplicación funcione sin conexión una vez que los recursos están cacheados.'
)

add_heading(doc, '8.2 Service Worker con estrategia diferenciada', level=2)
add_body(doc, 'El Service Worker distingue entre dos tipos de recursos:')
add_body_mixed(doc, [
    ('HTML de navegación (index.html): ', True, False),
    ('Estrategia network-first. La aplicación siempre intenta obtener la versión más reciente; el caché actúa '
     'solo como fallback offline. Esto garantiza que los usuarios con la PWA instalada reciban actualizaciones '
     'inmediatamente.', False, False),
])
add_body_mixed(doc, [
    ('Assets estáticos (JavaScript, CSS, íconos): ', True, False),
    ('Estrategia cache-first. Vite genera nombres de archivo con hash de contenido, por lo que cada URL es '
     'inmutable; servirlos desde el caché es seguro y elimina solicitudes de red innecesarias.', False, False),
])

add_heading(doc, '8.3 Onboarding de cuatro pantallas', level=2)
add_body(doc,
    'La aplicación presenta al usuario un flujo de bienvenida en su primera apertura: pantalla de splash, '
    'explicación del funcionamiento, solicitud de permisos de cámara y configuración inicial (cámara frontal '
    'o trasera). El flujo resuelve el problema de que el navegador solicite permisos de cámara sin contexto, '
    'lo que frecuentemente resulta en que el usuario los deniega por desconfianza.'
)

add_heading(doc, '8.4 Delay de hardware al cambiar de cámara', level=2)
add_body(doc,
    'En modo PWA instalada (standalone), el cambio entre cámara frontal y trasera produce una colisión de '
    'hardware: track.stop() es síncrono en JavaScript, pero el sensor físico de la cámara no libera el recurso '
    'inmediatamente. Se implementó un delay de 450 ms detectado mediante un flag de referencia en el ciclo de '
    'vida del efecto de React, valor determinado empíricamente para cubrir la mayoría de dispositivos Android e iOS.'
)

# ── 9. RESULTADOS ────────────────────────────
add_heading(doc, '9. Resultados', level=1)
add_body(doc,
    'La aplicación fue probada en dispositivos Android con Chrome y en iOS con Safari. '
    'Los resultados observados durante las pruebas son los siguientes:'
)
resultados = [
    ('Latencia de detección:', 'Subjetivamente imperceptible en dispositivos de gama media (2022 en adelante). '
     'La variante Lite del modelo procesa cada fotograma en menos de 30 ms en la mayoría de los casos, '
     'manteniendo la cadencia de 30 fps del stream de cámara.'),
    ('Precisión de conteo:', 'El gate de confirmación por fotogramas consecutivos eliminó las repeticiones '
     'falsas detectadas en versiones tempranas por movimientos bruscos de la cámara o por el ruido inherente '
     'de los landmarks en movimientos rápidos.'),
    ('Usabilidad:', 'El onboarding redujo la tasa de denegación de permisos de cámara al presentar el contexto '
     'antes del diálogo nativo del navegador. La retroalimentación de voz fue valorada positivamente durante '
     'las pruebas por permitir al usuario mantener la vista en el espejo de la pantalla sin necesidad de leer '
     'el texto del overlay.'),
    ('PWA:', 'La aplicación se instala correctamente en Android (Chrome) e iOS (Safari → "Agregar a pantalla de '
     'inicio") y se comporta como una aplicación nativa en modo standalone.'),
]
for label, desc in resultados:
    add_body_mixed(doc, [(f'{label} ', True, False), (desc, False, False)])

# ── 10. LIMITACIONES ─────────────────────────
add_heading(doc, '10. Limitaciones conocidas', level=1)
limitaciones = [
    'Dependencia de la posición de la cámara: La calidad de la detección depende de que el cuerpo completo '
    'sea visible y bien iluminado. En condiciones de poca luz o con oclusiones parciales (ropa holgada, '
    'accesorios), la precisión de los landmarks disminuye.',
    'Calibración por usuario: Los umbrales angulares fueron determinados empíricamente para una persona de '
    'proporciones corporales promedio. Usuarios con proporciones muy diferentes (brazos muy largos, torso muy '
    'corto) podrían requerir ajustes.',
    'Vista de la cámara: La sentadilla y el press de hombro ofrecen mejor cobertura con vista lateral o de 45°. '
    'La detección automática de vista en el curl de bíceps es heurística y puede presentar errores en '
    'configuraciones inusuales de encuadre.',
    'iOS Safari — SpeechSynthesis: El primer disparo de voz requiere un gesto previo del usuario (resuelto con '
    'el botón del onboarding). En iOS, las voces en español pueden variar según la región configurada en el dispositivo.',
]
for i, lim in enumerate(limitaciones, 1):
    add_numbered(doc, lim, i)

# ── 11. CONCLUSIONES ─────────────────────────
add_heading(doc, '11. Conclusiones', level=1)
add_body(doc,
    'El proyecto demostró que es técnicamente viable construir una aplicación de entrenamiento personal con '
    'retroalimentación en tiempo real usando exclusivamente tecnologías web gratuitas y el procesador del propio '
    'dispositivo móvil. La integración de MediaPipe Pose Landmarker como motor de inferencia permitió que el '
    'equipo se concentrara en la lógica de dominio —biomecánica de los ejercicios, diseño de las máquinas de '
    'estados, calidad del feedback— sin necesidad de entrenar ni mantener un modelo propio.'
)
add_body(doc,
    'Desde el punto de vista de la ingeniería de software, el proyecto consolidó prácticas de diseño orientadas '
    'a la robustez en condiciones adversas: histéresis para señales ruidosas, confirmación por fotogramas '
    'consecutivos para eventos que deben ser intencionales, estrategias diferenciadas de caché para recursos con '
    'distintos ciclos de vida, y manejo defensivo de APIs del navegador que pueden fallar silenciosamente.'
)
add_body(doc,
    'El trabajo realizado constituye una base sólida sobre la que podrían construirse extensiones aspiracionales: '
    'un clasificador automático de ejercicio entrenado con las secuencias de los 33 keypoints, retroalimentación '
    'personalizada basada en el historial del usuario, o soporte para ejercicios adicionales como planchas y lunges.'
)

# ── 12. REFERENCIAS ──────────────────────────
add_heading(doc, '12. Referencias', level=1)
referencias = [
    'Google LLC. (2024). MediaPipe Pose Landmarker guide. Google for Developers. '
    'https://developers.google.com/mediapipe/solutions/vision/pose_landmarker',

    'Google LLC. (2024). MediaPipe Tasks Vision — JavaScript API reference. '
    'https://developers.google.com/mediapipe/api/solutions/js/tasks-vision',

    'Mozilla Developer Network. (2024). MediaDevices.getUserMedia(). MDN Web Docs. '
    'https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia',

    'Mozilla Developer Network. (2024). Progressive web apps (PWAs). MDN Web Docs. '
    'https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps',

    'Mozilla Developer Network. (2024). SpeechSynthesis. MDN Web Docs. '
    'https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis',

    'React Team. (2024). React 19 documentation. https://react.dev',

    'Vitejs. (2024). Vite — Next Generation Frontend Tooling. https://vitejs.dev',

    'Newell, A., Yang, K., & Deng, J. (2016). Stacked hourglass networks for human pose estimation. '
    'European Conference on Computer Vision (ECCV). Springer, Cham.',

    'Cao, Z., Simon, T., Wei, S. E., & Sheikh, Y. (2017). Realtime multi-person 2D pose estimation using '
    'part affinity fields. Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR).',
]
for ref in referencias:
    add_footnote_style_ref(doc, ref)

# ── GUARDAR ──────────────────────────────────
out = os.path.abspath(OUTPUT_PATH)
doc.save(out)
print(f'Documento guardado: {out}')
