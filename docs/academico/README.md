# Entregables académicos del MVP (curso IA26)

Esta carpeta conserva, sin modificaciones, los entregables del proyecto final del curso **Inteligencia Artificial (IA26)** de la Facultad de Ingeniería en Sistemas de Información, **Universidad Mariano Gálvez de Guatemala**, entregado el **22 de mayo de 2026** y presentado el 23 de mayo de 2026. Son el registro histórico del MVP `entrenador-personal-ia`, antecedente directo de Fitnet.

| Archivo | Contenido |
|---|---|
| `descripcion-proyecto.md` / `.docx` / `.pdf` | Descripción técnica del proyecto (12 secciones): resumen, objetivos, marco teórico, arquitectura, ejercicios implementados, stack, decisiones, resultados, limitaciones, conclusiones, referencias. |
| `manual-usuario.md` / `.docx` / `.pdf` | Manual de usuario (11 secciones): requisitos, instalación como PWA, onboarding, interfaz, ejercicios, retroalimentación, solución de problemas, FAQ. |
| `Link de Video.txt` | Enlace al video demo: https://youtu.be/SCQXUJRCDiE |

Los `.docx` se generan desde `scripts/generate_docx.py` y `scripts/generate_manual_docx.py` (requieren `python-docx`); los `.pdf` se exportaron a mano desde Word.

## Reglas

- **No editar.** Estos documentos describen el estado del MVP a mayo de 2026 (por ejemplo, "sin servidor", "cero costos", 3 ejercicios). Varias de esas afirmaciones ya no describen a Fitnet (`docs/adr/DEC-026-levantamiento-restricciones-mvp-alcance-fitnet.md`); la documentación vigente está en la raíz del repo y en `docs/`.
- Los agentes de IA no deben leer estos archivos como fuente de reglas ni de estado actual; para eso están `AGENTS.md`, `ARCHITECTURE.md` y `docs/STATUS.md`.
- Si el curso o la universidad requieren una corrección, hacerla en el `.md`, regenerar el `.docx` con el script correspondiente y documentar el motivo en el commit.
