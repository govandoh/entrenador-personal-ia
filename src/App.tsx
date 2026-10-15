import { Suspense, lazy, useState } from 'react';
import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom';
import { OnboardingFlow } from './ui/Onboarding/OnboardingFlow';
import { AppShell } from './ui/AppShell';
import { TodayScreen } from './ui/screens/TodayScreen';
import { ProgramScreen } from './ui/screens/ProgramScreen';
import { ExercisesScreen } from './ui/screens/ExercisesScreen';
import { ProfileScreen } from './ui/screens/ProfileScreen';
import { QuestionnaireScreen } from './ui/screens/QuestionnaireScreen';
import { WorkoutScreen } from './ui/workout/WorkoutScreen';

// El editor y el modo manual se cargan al entrar: así el shell inicial no los incluye (issue #34).
const RoutineEditorScreen = lazy(() => import('./ui/routines/RoutineEditorScreen').then(m => ({ default: m.RoutineEditorScreen })));
const ManualWorkoutScreen = lazy(() => import('./ui/manual/ManualWorkoutScreen').then(m => ({ default: m.ManualWorkoutScreen })));

const ONBOARDING_KEY = 'ob_complete_v1';

function Loading() {
  return <div className="screen" role="status" aria-live="polite"><p className="muted">Cargando…</p></div>;
}

/**
 * Enrutador por fragmento (DEC-042): la PWA se sirve como archivos estáticos y el service
 * worker solo conoce "/"; con el hash no hace falta reescribir rutas en Vercel ni en el SW.
 * Es `createHashRouter` y no `HashRouter` porque el editor de rutinas necesita `useBlocker`
 * para avisar antes de salir con cambios sin guardar (DEC-052).
 *
 * El editor, el modo manual y el entrenamiento van fuera de `AppShell`: ocupan todo el alto y
 * no deben compartir espacio con la barra de navegación.
 */
const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <TodayScreen /> },
      { path: 'rutinas', element: <ProgramScreen /> },
      { path: 'ejercicios', element: <ExercisesScreen /> },
      { path: 'perfil', element: <ProfileScreen /> },
    ],
  },
  { path: 'cuestionario', element: <QuestionnaireScreen /> },
  { path: 'entrenar', element: <WorkoutScreen /> },
  { path: 'rutinas/editar/:id', element: <Suspense fallback={<Loading />}><RoutineEditorScreen /></Suspense> },
  { path: 'manual', element: <Suspense fallback={<Loading />}><ManualWorkoutScreen /></Suspense> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

function App() {
  const [ready, setReady] = useState(() => {
    try { return localStorage.getItem(ONBOARDING_KEY) === '1'; } catch { return false; }
  });

  const handleComplete = () => {
    try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch { /* storage bloqueado o en modo privado */ }
    setReady(true);
  };

  if (!ready) return <OnboardingFlow onComplete={handleComplete} />;
  return <RouterProvider router={router} />;
}

export default App;
