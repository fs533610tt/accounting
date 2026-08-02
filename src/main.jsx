import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './style/all.css'
import App from './App.jsx'

document.title = `作帳系統 (${__APP_VERSION__})`

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
