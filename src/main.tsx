import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles.css'
import { applyTheme, storedTheme } from './lib/themes'

// Apply the saved theme before the first paint. App re-checks it against the player's level once history loads.
applyTheme(storedTheme() ?? 'neon', false)

registerSW({ immediate: true })
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>)
