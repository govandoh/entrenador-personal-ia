# MM-Fit — registro y plan de conversión (Issue #38)

Estado: **Fase 1 completada (datos sintéticos). Fase 2 bloqueada.**
Sitio oficial: https://mmfit.github.io/ (Strömbäck, Huang, Radu, IMWUT 2020).

## Licencias verificadas (no son iguales entre artefactos)

| Artefacto | Licencia | Fuente |
|---|---|---|
| Código (`KDMStromback/mm-fit`) | MIT | github.com/KDMStromback/mm-fit/blob/master/LICENCE.txt |
| Video RGB (`w00`…`w20`) | CC BY 4.0 | zenodo.org/records/7672767 |
| **Paquete multimodal (etiquetas, pose, IMU)** | **Sin licencia verificada** | No aparece en sitio, repo ni Zenodo |

## Sesión elegida (cuando se autorice Fase 2)

Video `w19_rgb.mp4` (415.4 MB, el más chico). Etiquetas esperadas en
`mm-fit/w19/w19_labels.csv`, columnas `(startFrame, endFrame, repetitionCount,
activityClass)` según `EDA.ipynb` del repo oficial. El paquete con ese CSV **no tiene
URL oficial confirmada**; el único candidato (`s3.eu-west-2.amazonaws.com/vradu.uk/mm-fit.zip`)
es de un tercero.

## Bloqueo de Fase 2

No se descarga ni usa el paquete hasta confirmar con `@govandoh` o los autores
(`k.d.m.stromback@gmail.com`, `valentin.radu@sheffield.ac.uk`): 1) URL oficial vigente,
2) licencia/permiso explícito para el prototipo académico, 3) que cubra derivados
(landmarks), sin redistribuir video/zip.

## Mapeo MM-Fit → `exerciseId` de Fitnet (Fase 2)

`squats→squat`, `pushups→pushup`, `lunges→lunge`, `bicep_curls→curl`,
`dumbbell_shoulder_press→press`; el resto no tiene asistente en Fitnet hoy.

## Fase 1 — qué se probó

`convert_video_to_v2.py` + `make_synthetic_clip.py` produjeron y validaron
`ml/data/samples/synthetic_squat_smoke.json`. Ningún archivo real de MM-Fit se usó.
