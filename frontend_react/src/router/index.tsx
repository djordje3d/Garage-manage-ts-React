import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { isAuthenticated } from '../api/auth-storage'
import App from '../App'
import LoginView from '../views/LoginView'
import DashboardView from '../views/DashboardView'
import GarageDetailView from '../views/GarageDetailView'

function ProtectedRoute() {
  if (!isAuthenticated()) {
    const path = window.location.pathname
    const isAllGarages =
      path === '/dashboard' || path === '/dashboard/'
    const search = isAllGarages
      ? ''
      : `?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`
    return <Navigate to={`/login${search}`} replace />
  }
  return <Outlet />
}

function LoginGuard() {
  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}

export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      {
        path: 'login',
        element: <LoginGuard />,
        children: [{ index: true, element: <LoginView /> }],
      },
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'dashboard/:garageId?', element: <DashboardView /> },
          { path: 'garage/:id', element: <GarageDetailView /> },
        ],
      },
      { path: 'index.html', element: <Navigate to="/dashboard" replace /> },
      { path: 'Index.html', element: <Navigate to="/dashboard" replace /> },
    ],
  },
])
