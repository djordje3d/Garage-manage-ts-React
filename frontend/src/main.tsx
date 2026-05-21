import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './i18n'
import './index.css'
import './styles/index.css'
import './styles/zindex.css'
import './assets/icom/style.css'
import './components/ui/ui-components.css'
import { router } from './router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
