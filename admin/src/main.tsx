import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'

const rootEl = document.getElementById('root')

if (rootEl === null) {
  throw new Error('Root element not found - check admin/index.html for <div id="root">')
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
