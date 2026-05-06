import { useState, useEffect } from 'react';
import { SplashScreen } from './SplashScreen';
import { HowItWorksScreen } from './HowItWorksScreen';
import { PermissionsScreen } from './PermissionsScreen';
import { GetStartedScreen } from './GetStartedScreen';
import './onboarding.css';

interface Props {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: Props) {
  const [screen, setScreen] = useState(0);

  const next = () => setScreen(s => s + 1);

  // Splash auto-avanza después de 2.8s
  useEffect(() => {
    if (screen !== 0) return;
    const t = setTimeout(next, 2800);
    return () => clearTimeout(t);
  }, [screen]);

  const screens = [
    <SplashScreen key="splash" />,
    <HowItWorksScreen key="how" onNext={next} />,
    <PermissionsScreen key="perms" onNext={next} />,
    <GetStartedScreen key="start" onComplete={onComplete} />,
  ];

  return (
    <div className="ob-root">
      {screens[screen]}
    </div>
  );
}
