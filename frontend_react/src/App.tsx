import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from './composables/useToast'
import { ToastProvider, Toast } from './components/ui/Toast'
import { NewVehicleEntryModal } from './components/dashboard/NewVehicleEntryModal'
import { RefreshCountdownRing } from './components/dashboard/RefreshCountdownRing'
import { HelpTooltip } from './components/ui/HelpTooltip'
import { ButtonIn } from './components/ui/ButtonIn'
import { LanguageSwitcher } from './components/ui/LanguageSwitcher'
import { baseURL } from './api/client'
import { clearStoredToken, getMsUntilTokenExpiry } from './api/auth-storage'
import { clearGaragesCache } from './utils/garageCache'
import { refresh as refreshToken } from './api/auth'
import { useDashboardPolling } from './composables/useDashboardPolling'
import { DASHBOARD_REQUEST_REFRESH_EVENT } from './constants/dashboardRefresh'
import { DASHBOARD_REFRESH_EVENT } from './contexts/dashboardRefresh'
import './app.css'

const AUTO_REFRESH_STORAGE_KEY = 'dashboard-auto-refresh'
const IDLE_MS = 90 * 1000
const IDLE_ACTIVITY_THROTTLE_MS = 1000
const SESSION_EXPIRED_REDIRECT_MS = 3000
const POLL_MS = 10_000

function loadAutoRefreshEnabled(): boolean {
  try {
    return localStorage.getItem(AUTO_REFRESH_STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return s > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${m} min`
}

function refreshDashboardEverywhere() {
  window.dispatchEvent(new CustomEvent(DASHBOARD_REQUEST_REFRESH_EVENT))
}

export default function App() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()

  const isLoginPage = location.pathname === '/login'
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(loadAutoRefreshEnabled)
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [apiConnectionError, setApiConnectionError] = useState<string | null>(null)
  const [apiConnectionTimeout, setApiConnectionTimeout] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' && !navigator.onLine,
  )
  const [connectionRestoredToast, setConnectionRestoredToast] = useState(false)
  const [showIdleExpiryAlert, setShowIdleExpiryAlert] = useState(false)
  const [idleExpiryCountdown, setIdleExpiryCountdown] = useState('')
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false)
  const [sessionExpiredRedirectCountdown, setSessionExpiredRedirectCountdown] = useState('3')

  const connectionRestoredToastId = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionExpiredRedirectTimeoutId = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionExpiredCountdownIntervalId = useRef<ReturnType<typeof setInterval> | null>(null)
  const tokenExpiryTimeoutId = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimeoutId = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleCountdownIntervalId = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastActivityAt = useRef(0)

  const pollingEnabled = autoRefreshEnabled && !isLoginPage
  const { remainingMs, intervalMs, isRunning } = useDashboardPolling(
    refreshDashboardEverywhere,
    { intervalMs: POLL_MS, enabled: pollingEnabled },
  )

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_REFRESH_STORAGE_KEY, String(autoRefreshEnabled))
    } catch {
      // ignore
    }
  }, [autoRefreshEnabled])

  useEffect(() => {
    if (showNewEntry) toast.clearToast()
  }, [showNewEntry, toast])

  const connectionBannerMessage = useMemo(() => {
    if (isOffline) return t('connection.offline.title')
    if (apiConnectionTimeout) return t('connection.timeout.title')
    if (apiConnectionError) return t('connection.apiDown.title')
    return null
  }, [isOffline, apiConnectionTimeout, apiConnectionError, t])

  const connectionBannerDetail = useMemo(() => {
    if (isOffline) return t('connection.offline.detail')
    if (apiConnectionTimeout) return t('connection.timeout.detail')
    if (apiConnectionError?.length) {
      return t('connection.apiDown.detail', { baseURL: apiConnectionError })
    }
    return null
  }, [isOffline, apiConnectionTimeout, apiConnectionError, t])

  const connectionBannerVariant = isOffline
    ? 'connection-banner--offline'
    : apiConnectionTimeout
      ? 'connection-banner--timeout'
      : 'connection-banner--api-down'

  const connectionBannerIcon = isOffline ? '📡' : apiConnectionTimeout ? '⏱' : '⚠'

  const showConnectionRestoredToast = useCallback(() => {
    if (connectionRestoredToastId.current != null) {
      clearTimeout(connectionRestoredToastId.current)
    }
    setConnectionRestoredToast(true)
    connectionRestoredToastId.current = setTimeout(() => {
      setConnectionRestoredToast(false)
      connectionRestoredToastId.current = null
    }, 3000)
  }, [])

  const clearSessionTimers = useCallback(() => {
    if (tokenExpiryTimeoutId.current != null) {
      clearTimeout(tokenExpiryTimeoutId.current)
      tokenExpiryTimeoutId.current = null
    }
  }, [])

  const clearAllTimers = useCallback(() => {
    clearSessionTimers()
    if (idleTimeoutId.current != null) {
      clearTimeout(idleTimeoutId.current)
      idleTimeoutId.current = null
    }
    if (idleCountdownIntervalId.current != null) {
      clearInterval(idleCountdownIntervalId.current)
      idleCountdownIntervalId.current = null
    }
  }, [clearSessionTimers])

  const updateIdleExpiryCountdown = useCallback(() => {
    const ms = getMsUntilTokenExpiry()
    if (ms !== null && ms > 0) {
      setIdleExpiryCountdown(formatCountdown(ms))
    }
  }, [])

  const goToLoginAfterExpired = useCallback(() => {
    if (sessionExpiredRedirectTimeoutId.current != null) {
      clearTimeout(sessionExpiredRedirectTimeoutId.current)
      sessionExpiredRedirectTimeoutId.current = null
    }
    if (sessionExpiredCountdownIntervalId.current != null) {
      clearInterval(sessionExpiredCountdownIntervalId.current)
      sessionExpiredCountdownIntervalId.current = null
    }
    setShowSessionExpiredModal(false)
    clearGaragesCache()
    clearStoredToken()
    navigate('/login?reason=expired')
  }, [navigate])

  const onSessionExpired = useCallback(() => {
    setShowSessionExpiredModal((open) => {
      if (open) return open
      let remainingMs = SESSION_EXPIRED_REDIRECT_MS
      setSessionExpiredRedirectCountdown(String(Math.ceil(remainingMs / 1000)))
      sessionExpiredCountdownIntervalId.current = setInterval(() => {
        remainingMs -= 1000
        setSessionExpiredRedirectCountdown(String(Math.max(0, Math.ceil(remainingMs / 1000))))
        if (remainingMs <= 0 && sessionExpiredCountdownIntervalId.current != null) {
          clearInterval(sessionExpiredCountdownIntervalId.current)
          sessionExpiredCountdownIntervalId.current = null
        }
      }, 1000)
      sessionExpiredRedirectTimeoutId.current = setTimeout(() => {
        sessionExpiredRedirectTimeoutId.current = null
        if (sessionExpiredCountdownIntervalId.current != null) {
          clearInterval(sessionExpiredCountdownIntervalId.current)
          sessionExpiredCountdownIntervalId.current = null
        }
        setShowSessionExpiredModal(false)
        clearGaragesCache()
        clearStoredToken()
        navigate('/login?reason=expired')
      }, SESSION_EXPIRED_REDIRECT_MS)
      return true
    })
  }, [navigate])

  const onIdleTimeout = useCallback(() => {
    idleTimeoutId.current = null
    setShowIdleExpiryAlert(true)
    updateIdleExpiryCountdown()
    idleCountdownIntervalId.current = setInterval(updateIdleExpiryCountdown, 1000)
  }, [updateIdleExpiryCountdown])

  const resetIdleTimer = useCallback(() => {
    if (showIdleExpiryAlert) return
    if (idleTimeoutId.current != null) clearTimeout(idleTimeoutId.current)
    idleTimeoutId.current = setTimeout(onIdleTimeout, IDLE_MS)
  }, [showIdleExpiryAlert, onIdleTimeout])

  const scheduleTokenExpiryLogout = useCallback(() => {
    clearSessionTimers()
    const ms = getMsUntilTokenExpiry()
    if (ms === null) return
    if (ms <= 0) {
      onSessionExpired()
      return
    }
    tokenExpiryTimeoutId.current = setTimeout(() => {
      tokenExpiryTimeoutId.current = null
      if (idleCountdownIntervalId.current != null) {
        clearInterval(idleCountdownIntervalId.current)
        idleCountdownIntervalId.current = null
      }
      onSessionExpired()
    }, ms)
  }, [clearSessionTimers, onSessionExpired])

  const startSessionTimers = useCallback(() => {
    if (getMsUntilTokenExpiry() === null) return
    resetIdleTimer()
    scheduleTokenExpiryLogout()
  }, [resetIdleTimer, scheduleTokenExpiryLogout])

  const extendSession = useCallback(async () => {
    setShowIdleExpiryAlert(false)
    if (idleCountdownIntervalId.current != null) {
      clearInterval(idleCountdownIntervalId.current)
      idleCountdownIntervalId.current = null
    }
    try {
      await refreshToken()
      clearAllTimers()
      startSessionTimers()
    } catch {
      // 401 handled by interceptor
    }
  }, [clearAllTimers, startSessionTimers])

  const logout = useCallback(() => {
    setShowIdleExpiryAlert(false)
    if (idleCountdownIntervalId.current != null) {
      clearInterval(idleCountdownIntervalId.current)
      idleCountdownIntervalId.current = null
    }
    if (idleTimeoutId.current != null) {
      clearTimeout(idleTimeoutId.current)
      idleTimeoutId.current = null
    }
    clearGaragesCache()
    clearStoredToken()
    navigate('/login')
  }, [navigate])

  const onActivity = useCallback(() => {
    const now = Date.now()
    if (now - lastActivityAt.current < IDLE_ACTIVITY_THROTTLE_MS) return
    lastActivityAt.current = now
    if (isLoginPage || getMsUntilTokenExpiry() === null) return
    resetIdleTimer()
  }, [isLoginPage, resetIdleTimer])

  useEffect(() => {
    const onApiError = (e: Event) => {
      setApiConnectionError((e as CustomEvent).detail?.baseURL ?? baseURL)
    }
    const onApiTimeout = (e: Event) => {
      setApiConnectionTimeout((e as CustomEvent).detail?.baseURL ?? baseURL)
    }
    const onApiOk = () => {
      const hadError = apiConnectionError != null || apiConnectionTimeout != null
      setApiConnectionError(null)
      setApiConnectionTimeout(null)
      if (hadError && !isLoginPage) showConnectionRestoredToast()
    }
    const onBrowserOffline = () => setIsOffline(true)
    const onBrowserOnline = () => {
      setIsOffline((was) => {
        if (!isLoginPage && was) showConnectionRestoredToast()
        return false
      })
    }

    window.addEventListener('api-connection-error', onApiError)
    window.addEventListener('api-connection-timeout', onApiTimeout)
    window.addEventListener('api-connection-ok', onApiOk)
    window.addEventListener('offline', onBrowserOffline)
    window.addEventListener('online', onBrowserOnline)
    window.addEventListener('mousemove', onActivity)
    window.addEventListener('click', onActivity)
    window.addEventListener('keydown', onActivity)
    window.addEventListener('session-expired', onSessionExpired)

    if (!isLoginPage) startSessionTimers()

    return () => {
      window.removeEventListener('api-connection-error', onApiError)
      window.removeEventListener('api-connection-timeout', onApiTimeout)
      window.removeEventListener('api-connection-ok', onApiOk)
      window.removeEventListener('offline', onBrowserOffline)
      window.removeEventListener('online', onBrowserOnline)
      window.removeEventListener('mousemove', onActivity)
      window.removeEventListener('click', onActivity)
      window.removeEventListener('keydown', onActivity)
      window.removeEventListener('session-expired', onSessionExpired)
      if (connectionRestoredToastId.current != null) {
        clearTimeout(connectionRestoredToastId.current)
      }
      clearAllTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoginPage])

  useEffect(() => {
    if (isLoginPage) {
      clearAllTimers()
      setShowIdleExpiryAlert(false)
      setShowSessionExpiredModal(false)
    } else if (getMsUntilTokenExpiry() !== null) {
      startSessionTimers()
    }
  }, [isLoginPage, clearAllTimers, startSessionTimers])

  const onNewEntryDone = () => {
    queueMicrotask(() => {
      setShowNewEntry(false)
      toast.showToast('Vehicle entry created.')
      window.dispatchEvent(new CustomEvent(DASHBOARD_REFRESH_EVENT))
    })
  }

  return (
    <ToastProvider value={toast}>
      <div className="min-h-screen bg-gray-100">
        {!isLoginPage && connectionBannerMessage ? (
          <div
            className={`connection-banner ${connectionBannerVariant}`}
            role="alert"
            aria-live="assertive"
          >
            <span className="connection-banner__icon" aria-hidden="true">
              {connectionBannerIcon}
            </span>
            <div className="connection-banner__content">
              <p className="connection-banner__title">{connectionBannerMessage}</p>
              {connectionBannerDetail ? (
                <p className="connection-banner__detail">{connectionBannerDetail}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {connectionRestoredToast ? (
          <div className="connection-restored-toast" role="status" aria-live="polite">
            <span className="connection-restored-toast__icon" aria-hidden="true">
              ✓
            </span>
            {t('connection.restored')}
          </div>
        ) : null}

        {!isLoginPage && toast.message.trim() ? (
          <Toast />
        ) : null}

        {!isLoginPage && showIdleExpiryAlert ? (
          <div
            className="session-expiry-overlay"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="session-expiry-title"
          >
            <div className="session-expiry-modal">
              <p id="session-expiry-title" className="font-medium">
                {t('session.idle.title', { countdown: idleExpiryCountdown })}
              </p>
              <p className="mt-1 text-sm opacity-90">{t('session.idle.detail')}</p>
              <ButtonIn
                id="extendSessionBtn"
                type="button"
                variant="primary"
                className="mt-4 shrink-0 !bg-amber-600 hover:!bg-amber-700 focus:ring-amber-500"
                onUserClick={() => void extendSession()}
              >
                {t('session.idle.continue')}
              </ButtonIn>
            </div>
          </div>
        ) : null}

        {!isLoginPage && showSessionExpiredModal ? (
          <div
            className="session-expiry-overlay"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="session-expired-title"
          >
            <div className="session-expired-modal">
              <p id="session-expired-title" className="font-medium">
                {t('session.expired.title')}
              </p>
              <p className="mt-1 text-sm opacity-90">
                {t('session.expired.detail', {
                  countdown: sessionExpiredRedirectCountdown,
                })}
              </p>
              <ButtonIn
                id="sessionExpiredLoginBtn"
                type="button"
                variant="primary"
                className="mt-4 shrink-0 !bg-slate-700 hover:!bg-slate-800 focus:ring-slate-500"
                onUserClick={goToLoginAfterExpired}
              >
                {t('session.expired.goToLogin')}
              </ButtonIn>
            </div>
          </div>
        ) : null}

        {isLoginPage ? (
          <Outlet />
        ) : (
          <>
            <header className="bg-transparent text-white">
              <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-y-3 gap-x-4 px-4 py-3 sm:px-6">
                <nav className="flex flex-wrap items-center gap-2 sm:gap-4">
                  <Link
                    to="/dashboard"
                    className="text-base font-semibold sm:text-3xl text-black"
                  >
                    {t('header.dashboard')}
                  </Link>
                </nav>
                <div className="flex flex-shrink-0 flex-wrap items-center gap-y-2 gap-x-5">
                  <HelpTooltip text={t('help.autoRefresh')}>
                    <RefreshCountdownRing
                      durationMs={intervalMs}
                      remainingMs={remainingMs}
                      enabled={isRunning}
                      autoRefreshEnabled={autoRefreshEnabled}
                      onToggleAutoRefresh={() => setAutoRefreshEnabled((v) => !v)}
                    />
                  </HelpTooltip>
                  <div
                    role="button"
                    tabIndex={0}
                    title={t('garageDetail.refreshNow')}
                    className="flex cursor-pointer items-center justify-center rounded p-1.5 text-green-500 transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus:ring-green-500/50"
                    onClick={refreshDashboardEverywhere}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        refreshDashboardEverywhere()
                      }
                    }}
                  >
                    <span
                      className="icon-spinner11 text-[42px] leading-none"
                      aria-hidden="true"
                    />
                  </div>
                  <ButtonIn
                    id="logoutBtn"
                    className="h-12"
                    variant="outline"
                    label={t('header.logout')}
                    caption={t('header.logout')}
                    onUserClick={logout}
                  />
                  <ButtonIn
                    id="newVehicleEntryBtn"
                    className="h-12"
                    variant="primary"
                    label={t('header.newVehicleEntry')}
                    caption={t('header.newVehicleEntry')}
                    onUserClick={() => setShowNewEntry(true)}
                  />
                  <LanguageSwitcher />
                </div>
              </div>
            </header>
            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
              <Outlet />
            </main>
            <NewVehicleEntryModal
              modelValue={showNewEntry}
              onModelValueChange={setShowNewEntry}
              onDone={onNewEntryDone}
            />
          </>
        )}
      </div>
    </ToastProvider>
  )
}
