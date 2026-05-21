import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { login } from '../api/auth'
import { parseApiError } from '../api/error'
import { ButtonIn } from '../components/ui/ButtonIn'
import { InputIn } from '../components/ui/InputIn'
import './login-view.css'

export default function LoginView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const sessionExpiredMessage = useMemo(
    () => (searchParams.get('reason') === 'expired' ? t('login.sessionExpired') : ''),
    [searchParams, t],
  )

  const canSubmit = username.trim().length > 0 && password.trim().length > 0

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || isSubmitting) return
    setError('')
    setIsSubmitting(true)
    try {
      await login(username, password)
      const redirect = searchParams.get('redirect') || '/dashboard'
      navigate(redirect)
    } catch (err: unknown) {
      setError(
        parseApiError(err, 'Login failed. Check username and password.').message,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="bg-layer" aria-hidden="true" />
      <div className="login-content flex min-h-screen items-center justify-center px-4">
        <div className="card dashboard-card w-full max-w-sm px-6 py-8">
          <h1 className="mb-6 text-center text-xl font-semibold text-slate-800">
            {t('login.title')}
          </h1>
          {sessionExpiredMessage ? (
            <p
              className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
              role="status"
            >
              {sessionExpiredMessage}
            </p>
          ) : null}
          <form onSubmit={onSubmit} className="space-y-4">
            <InputIn
              id="username"
              modelValue={username}
              onModelValueChange={(v) => setUsername(String(v))}
              label={t('login.username')}
              type="text"
              required
              autoComplete="username"
            />
            <InputIn
              id="password"
              modelValue={password}
              onModelValueChange={(v) => setPassword(String(v))}
              label={t('login.password')}
              type="password"
              required
              autoComplete="current-password"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <ButtonIn
              id="signInBtn"
              label={t('login.signIn')}
              variant="primary"
              type="submit"
              disabled={!canSubmit || isSubmitting}
              caption={t('login.signIn')}
              className="w-full"
            />
          </form>
        </div>
      </div>
    </div>
  )
}
