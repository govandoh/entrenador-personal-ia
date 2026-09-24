import { useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { OnboardingFlow } from './ui/Onboarding/OnboardingFlow';
import { AppShell } from './ui/AppShell';
import { TodayScreen } from './ui/screens/TodayScreen';
import { ProgramScreen } from './ui/screens/ProgramScreen';
import { ExercisesScreen } from './ui/screens/ExercisesScreen';
import { ProfileScreen } from './ui/screens/ProfileScreen';
import { QuestionnaireScreen } from './ui/screens/QuestionnaireScreen';
import { WorkoutScreen } from './ui/workout/WorkoutScreen';

const ONBOARDING_KEY = 'ob_complete_v1';

function App() {
  const [ready, setReady] = useState(() => {
    try { return localStorage.getItem(ONBOARDING_KEY) === '1'; } catch { return false; }
  });

  const handleComplete = () => {
    try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch { /* storage bloqueado o en modo privado */ }
    setReady(true);
  };

  if (!ready) return <OnboardingFlow onComplete={handleComplete} />;

  // HashRouter (DEC-042): la PWA se sirve como archivos estáticos y el service worker solo
  // conoce "/"; con el hash no hace falta reescribir rutas en Vercel ni en el SW.
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<TodayScreen />} />
          <Route path="rutinas" element={<ProgramScreen />} />
          <Route path="ejercicios" element={<ExercisesScreen />} />
          <Route path="perfil" element={<ProfileScreen />} />
        </Route>
        <Route path="cuestionario" element={<QuestionnaireScreen />} />
        <Route path="entrenar" element={<WorkoutScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
