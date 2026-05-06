export function SplashScreen() {
  return (
    <div className="ob-screen ob-splash">
      <div className="ob-logo-wrap">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <defs>
            <linearGradient id="splashGrad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#30D158" />
              <stop offset="100%" stopColor="#34AADC" />
            </linearGradient>
          </defs>
          {/* Icono redondeado estilo iOS */}
          <rect width="120" height="120" rx="28" fill="url(#splashGrad)" />
          {/* Cabeza */}
          <circle cx="60" cy="24" r="8" fill="white" />
          {/* Esqueleto */}
          <line x1="60" y1="32" x2="60" y2="67" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="60" y1="44" x2="40" y2="57" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="60" y1="44" x2="80" y2="57" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="60" y1="67" x2="49" y2="91" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="60" y1="67" x2="71" y2="91" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          {/* Puntos de pose (amarillo = landmarks MediaPipe) */}
          <circle cx="60" cy="33" r="3.5" fill="#FFD60A" />
          <circle cx="43" cy="45" r="3"   fill="#FFD60A" />
          <circle cx="77" cy="45" r="3"   fill="#FFD60A" />
          <circle cx="40" cy="57" r="3.5" fill="#FFD60A" />
          <circle cx="80" cy="57" r="3.5" fill="#FFD60A" />
          <circle cx="60" cy="67" r="3.5" fill="#FFD60A" />
          <circle cx="53" cy="79" r="3"   fill="#FFD60A" />
          <circle cx="67" cy="79" r="3"   fill="#FFD60A" />
          <circle cx="49" cy="91" r="3.5" fill="#FFD60A" />
          <circle cx="71" cy="91" r="3.5" fill="#FFD60A" />
        </svg>
      </div>

      <h1 className="ob-app-name">Entrenador IA</h1>
      <p className="ob-app-tagline">Tu entrenador personal con inteligencia artificial</p>

      <div className="ob-dots-loader">
        <span /><span /><span />
      </div>
    </div>
  );
}
