# Correr la conversión en Kaggle (gratis, `DEC-035`)

Fase 1 (dry-run sintético) y Fase 2 (MM-Fit RGB real, CC BY 4.0). Las **etiquetas**
originales de MM-Fit siguen bloqueadas hasta confirmar enlace oficial y licencia
(`ml/datasets/mm-fit/README.md`); la Fase 2 de abajo usa solo video RGB.

1. Notebook en kaggle.com (Accelerator: None; no hace falta GPU para un clip corto).
2. Subir, sin video ni datos de usuario: `requirements.txt`, `make_synthetic_clip.py`,
   `convert_video_to_v2.py`, `validate_v2.py`.
3. `pip install -r requirements.txt`
4. `python make_synthetic_clip.py --out /kaggle/working/synthetic.mp4`
5. ```bash
   python convert_video_to_v2.py --video /kaggle/working/synthetic.mp4 \
     --exercise-id squat --subject-id anon-smoke --synthetic \
     --out /kaggle/working/synthetic_squat_smoke.json
   ```
6. `python validate_v2.py /kaggle/working/synthetic_squat_smoke.json`
7. Descargar solo el JSON. Nunca el `.mp4` (ya está en `.gitignore`).

## Fase 2 (MM-Fit RGB real, CC BY 4.0)

1. Subir `w19_rgb.mp4` (descargado de Zenodo, `https://zenodo.org/records/7672767`)
   como dataset privado de Kaggle. No subir CSV de etiquetas (bloqueado).
2. Convertir un recorte corto, anotando procedencia y licencia:
   ```bash
   python convert_video_to_v2.py --video /kaggle/input/mmfit-w19/w19_rgb.mp4 \
     --exercise-id squat --subject-id mmfit-w19 --view front \
     --start-sec 12 --duration-sec 8 \
     --dataset-id mm-fit --source-url https://zenodo.org/records/7672767 \
     --license "CC BY 4.0" \
     --out /kaggle/working/mmfit_w19_squat_v2.json
   ```
3. `python validate_v2.py /kaggle/working/mmfit_w19_squat_v2.json`
4. Descargar solo el JSON resultante. Nunca el `.mp4`.
