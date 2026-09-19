/**
 * Conventional commits en español.
 * - Sin límite de longitud de cuerpo/pie (los commits del repo documentan decisiones y llevan Co-Authored-By).
 * - subject-case desactivado: el español usa tildes y mayúsculas en nombres propios (React, MediaPipe).
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
    'header-max-length': [2, 'always', 120],
    'subject-case': [0],
  },
}
