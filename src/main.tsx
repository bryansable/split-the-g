import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { installTiltPermissionOnTap } from './camera/tilt'
import './index.css'

registerSW({ immediate: true })
installTiltPermissionOnTap()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
