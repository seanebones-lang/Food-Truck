import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initSentry } from './utils/sentry'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import App from './App.jsx'

// Initialize Sentry before anything else
initSentry()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
