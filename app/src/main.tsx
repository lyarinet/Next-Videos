import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Admin from './Admin.tsx'
import ContentPage from './ContentPage.tsx'
import UserWorkspace from './UserWorkspace.tsx'
import { Toaster } from 'sonner'

function Router() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
    fetch(`${API_BASE_URL}/config?t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error && data.theme === 'premium') {
          document.body.classList.add('theme-premium');
        } else {
          document.body.classList.remove('theme-premium');
        }
      })
      .catch(() => {});
  }, []);

  if (route.startsWith('#/admin')) {
    return <Admin />;
  }

  if (route.startsWith('#/workspace')) {
    return <UserWorkspace />;
  }

  if (route.startsWith('#/terms')) {
    return <ContentPage title="Terms of Service" field="termsContent" />;
  }

  if (route.startsWith('#/privacy')) {
    return <ContentPage title="Privacy Policy" field="privacyContent" />;
  }

  if (route.startsWith('#/contact')) {
    return <ContentPage title="Contact Us" field="contactContent" />;
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
    <Toaster richColors />
  </StrictMode>,
)
