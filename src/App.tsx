import { useState } from 'react';
import { CameraView } from './ui/CameraView';
import { OnboardingFlow } from './ui/Onboarding/OnboardingFlow';

const ONBOARDING_KEY = 'ob_complete_v1';

function App() {
  const [ready, setReady] = useState(() => localStorage.getItem(ONBOARDING_KEY) === '1');

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setReady(true);
  };

  if (!ready) return <OnboardingFlow onComplete={handleComplete} />;
  return <CameraView />;
}

export default App;
