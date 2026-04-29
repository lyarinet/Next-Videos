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
