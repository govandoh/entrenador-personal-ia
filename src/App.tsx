import { useState } from 'react';
import { CameraView } from './ui/CameraView';
import { OnboardingFlow } from './ui/Onboarding/OnboardingFlow';

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
  return <CameraView />;
}

export default App;
