import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/main.css';

function App() {
  const [status, setStatus] = useState('Checking the local backend…');

  useEffect(() => {
    const controller = new AbortController();
    async function checkHealth() {
      try {
        const response = await fetch('/api/health', {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Backend unavailable');
        const data: unknown = await response.json();
        if (
          typeof data !== 'object' ||
          data === null ||
          !('status' in data) ||
          data.status !== 'ok'
        ) {
          throw new Error('Unexpected health response');
        }
        setStatus('The local backend is ready.');
      } catch {
        if (!controller.signal.aborted) {
          setStatus(
            'The local backend is unavailable. Please start it and reload.',
          );
        }
      }
    }
    void checkHealth();
    return () => controller.abort();
  }, []);

  return (
    <main>
      <h1>Mizizi</h1>
      <p>A family herbarium, rooted in shared walks.</p>
      <p role="status">{status}</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
