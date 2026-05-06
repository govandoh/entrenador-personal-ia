import { useCallback } from 'react';

/**
 * Hook para síntesis de voz en español.
 * Cancela la locución anterior antes de iniciar la siguiente para evitar
 * que los mensajes se acumulen cuando el usuario hace reps rápidas.
 *
 * iOS requiere que la primera llamada ocurra dentro de un evento de usuario.
 * El tap "Comenzar a entrenar" del onboarding desbloquea el audio context,
 * por lo que las llamadas posteriores desde RAF funcionan correctamente.
 */
export function useSpeech() {
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang   = 'es-ES';
    utterance.rate   = 1.05;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  }, []);

  return speak;
}
