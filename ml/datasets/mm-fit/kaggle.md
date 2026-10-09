# Correr la conversión en Kaggle (gratis, `DEC-035`)

Fase 1 (dry-run sintético). Fase 2 (MM-Fit real) bloqueada hasta confirmar enlace
oficial y licencia de etiquetas (`ml/datasets/mm-fit/README.md`).

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

Fase 2 (no ejecutar todavía): subir `w19_rgb.mp4` + `w19_labels.csv` como dataset
privado, correr el conversor sin `--synthetic` y validar antes de declarar #38 cumplida.
