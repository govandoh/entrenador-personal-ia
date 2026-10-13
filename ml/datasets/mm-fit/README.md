# MM-Fit — registro y plan de conversión (Issue #38)

Estado: **Fase 1 completada (datos sintéticos). Fase 2 en curso: video RGB real de
Zenodo (CC BY 4.0). El paquete multimodal con etiquetas sigue bloqueado (ver abajo).**
Sitio oficial: https://mmfit.github.io/ (Strömbäck, Huang, Radu, IMWUT 2020).

## Licencias verificadas (no son iguales entre artefactos)

| Artefacto | Licencia | Fuente |
|---|---|---|
| Código (`KDMStromback/mm-fit`) | MIT | github.com/KDMStromback/mm-fit/blob/master/LICENCE.txt |
| Video RGB (`w00`…`w20`) | CC BY 4.0 | zenodo.org/records/7672767 |
| **Paquete multimodal (etiquetas, pose, IMU)** | **Sin licencia verificada** | No aparece en sitio, repo ni Zenodo |

## Sesión elegida para la Fase 2 (video RGB)

Video `w19_rgb.mp4` (415.4 MB, el más chico de la sesión), descargado directamente de
Zenodo (DOI `10.5281/zenodo.7672767`), licencia **CC BY 4.0** verificada en la página
del registro. Se convierte un recorte corto (no el video completo) para mantener el PR
liviano; el `.mp4` nunca se sube al repositorio (`.gitignore`).

## Etiquetas originales: siguen bloqueadas

Las etiquetas por set (`startFrame, endFrame, repetitionCount, activityClass`, formato
confirmado en `utils/utils.py::load_labels` del repo oficial) viven en el **paquete
multimodal**, no en Zenodo. El único candidato de URL (
`s3.eu-west-2.amazonaws.com/vradu.uk/mm-fit.zip`) es del bucket de un coautor, enlazado
por terceros, pero **no publicado hoy en una página oficial** del proyecto. No se
descarga ni se usa hasta confirmar con `@govandoh` o los autores
(`k.d.m.stromback@gmail.com`, `valentin.radu@sheffield.ac.uk`): 1) URL oficial vigente,
2) licencia/permiso explícito para el prototipo académico, 3) que cubra derivados
(landmarks), sin redistribuir video/zip.

**Por eso la Fase 2 de esta entrega usa solo el video RGB** (licencia clara) y etiqueta
el clip manualmente como un único `exercise` (sin segmentación por rep ni recuento
oficial), documentado como limitación explícita más abajo.

## Mapeo MM-Fit → `exerciseId` de Fitnet (Fase 2)

`squats→squat`, `pushups→pushup`, `lunges→lunge`, `bicep_curls→curl`,
`dumbbell_shoulder_press→press`; el resto no tiene asistente en Fitnet hoy.

## Fase 1 — qué se probó

`convert_video_to_v2.py` + `make_synthetic_clip.py` produjeron y validaron
`ml/data/samples/synthetic_squat_smoke.json`. Ningún archivo real de MM-Fit se usó.

## Fase 2 — procedimiento con MM-Fit real (solo RGB, sin etiquetas)

```bash
# 1. Descargar el video RGB de Zenodo (CC BY 4.0), fuera del repo.
curl -L -o ml/data/raw/w19_rgb.mp4 \
  "https://zenodo.org/records/7672767/files/w19_rgb.mp4?download=1"

# 2. Convertir un recorte corto (p. ej. 8 s desde el segundo 12) con MediaPipe lite,
#    anotando procedencia y licencia en los metadatos v2.
python ml/datasets/mm-fit/convert_video_to_v2.py \
  --video ml/data/raw/w19_rgb.mp4 \
  --exercise-id squat --subject-id mmfit-w19 --view front \
  --start-sec 12 --duration-sec 8 \
  --dataset-id mm-fit --source-url https://zenodo.org/records/7672767 \
  --license "CC BY 4.0" \
  --citation "Strömbäck, Huang, Radu. 2020. MM-Fit. ACM IMWUT 4(4):168. doi.org/10.1145/3432701" \
  --notes "Recorte de w19_rgb.mp4; sin etiquetas oficiales (paquete multimodal bloqueado)." \
  --out ml/data/out/mmfit_w19_squat_v2.json

# 3. Validar contra el esquema v2.
python ml/datasets/validate_v2.py ml/data/out/mmfit_w19_squat_v2.json

# 4. Tests unitarios del validador (sin red, sin video).
python -m pytest ml/datasets/test_validate_v2.py -v
```

**Resultados reales de esta ejecución:** ver `ml/README.md` §"Evidencia de la Fase 2"
(se completa con la salida real de los comandos de arriba; no se declaran resultados
sin haberlos corrido).

### Limitaciones conocidas de esta conversión

- El clip se etiqueta manualmente como un único `exercise` visualmente confirmado; **no**
  usa el CSV oficial de MM-Fit (bloqueado por licencia, ver arriba).
- No hay segmentación por repetición ni conteo oficial de reps.
- El recorte es un subconjunto corto de `w19_rgb.mp4`, no la sesión completa.
