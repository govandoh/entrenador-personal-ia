import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/tokens.css'
import './ui/base.css'
import './ui/screens/screens.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
