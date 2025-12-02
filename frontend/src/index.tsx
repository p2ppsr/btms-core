// frontend/src/index.tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import App from './App'
import web3Theme from './theme'
import { btms } from './btms/index'

// eslint-disable-next-line no-console
console.log('[index.tsx] bundle loaded (react 18 createRoot)')

// ---- global BTMS fail-soft patch ----
;(function patchBTMS() {
  const anyBtms = btms as any
  if (!anyBtms || typeof anyBtms.listAssets !== 'function') return
  if (anyBtms.__safeListAssets) return

  const original = anyBtms.listAssets.bind(anyBtms)

  anyBtms.listAssets = async (...args: any[]) => {
    try {
      return await original(...args)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('btms.listAssets failed (likely LARS / desktop / wallet not running). Returning empty list.', err)
      return []
    }
  }

  anyBtms.__safeListAssets = true
})()
// ---- end patch ----

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('#root not found in DOM')
}

const root = createRoot(rootEl)

const renderApp = (Component: React.ComponentType) => {
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <ThemeProvider theme={web3Theme}>
          <CssBaseline />
          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
          />
          <Component />
        </ThemeProvider>
      </BrowserRouter>
    </React.StrictMode>
  )
}

renderApp(App)

// Vite HMR (safe no-op if not running under Vite)
if (import.meta.hot) {
  import.meta.hot.accept()
}
