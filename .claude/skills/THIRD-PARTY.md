# Código de terceros en `.claude/skills/`

## Skills de Emil Kowalski

Las carpetas `emil-design-eng`, `animate`, `review-animations`, `improve-animations`, `find-animation-opportunities`, `animation-vocabulary`, `mobile-native` y `pick-ui-library` vienen de [emilkowalski/skills](https://github.com/emilkowalski/skills) (commit `d16ebe60d09a5ba2afcb7054ede9d0a10c9f6128`), publicadas en https://emilkowal.ski/skill bajo licencia MIT.

Cambios hechos al instalarlas en Fitnet (`DEC-058`):

- Se quitó la sección "Initial Response" de cada `SKILL.md`, que obligaba a responder con una frase fija.
- Se añadió al inicio de cada `SKILL.md` una nota que remite a `.claude/skills/fitnet-diseno/SKILL.md`, cuyas reglas prevalecen.
- No se instalaron `animate-expo`, `write-swift`, `apple-design`, `prototype` ni `ask-sonner`: son para React Native, Swift, estilo de Apple o librerías que Fitnet no usa.

Para actualizarlas: copiar de nuevo las carpetas desde el repositorio de origen, repetir los dos cambios anteriores y actualizar el commit de esta página.

Texto de la licencia:

```
MIT License

Copyright (c) 2026 Emil Kowalski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
