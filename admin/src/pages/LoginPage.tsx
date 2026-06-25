import React, { useState } from 'react'

import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'

import { auth } from '../firebase'

export const LoginPage = (): React.JSX.Element => {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleSignIn = async (): Promise<void> => {
    setError(null)
    setIsLoading(true)

    try {
      const provider = new GoogleAuthProvider()
      const credential = await signInWithPopup(auth, provider)
      const tokenResult = await credential.user.getIdTokenResult(true)
      const isAdmin = tokenResult.claims['admin'] === true

      if (!isAdmin) {
        await signOut(auth)
        setError('This account does not have admin access. Contact your administrator.')
        return
      }

      navigate('/dashboard', { replace: true })
    } catch {
      setError('Sign-in failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Fitlink Admin</h1>
        <p style={styles.subtitle}>Sign in with your admin Google account</p>

        {error !== null && <div style={styles.error}>{error}</div>}

        <button
          disabled={isLoading}
          onClick={() => {
            void handleGoogleSignIn()
          }}
          style={isLoading ? styles.buttonDisabled : styles.button}
          type="button"
        >
          {isLoading ? 'Signing in...' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  )
}

const baseButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600,
  padding: '10px 16px',
  width: '100%',
}

const styles = {
  page: {
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif',
    height: '100vh',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    padding: '40px',
    textAlign: 'center',
    width: '360px',
  },
  title: {
    color: '#111827',
    fontSize: '24px',
    fontWeight: 700,
    marginBottom: '8px',
    marginTop: 0,
  },
  subtitle: {
    color: '#6b7280',
    fontSize: '14px',
    marginBottom: '32px',
    marginTop: 0,
  },
  error: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    color: '#dc2626',
    fontSize: '14px',
    marginBottom: '16px',
    padding: '12px',
    textAlign: 'left',
  },
  button: {
    ...baseButtonStyle,
    backgroundColor: '#1a73e8',
    cursor: 'pointer',
  },
  buttonDisabled: {
    ...baseButtonStyle,
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
  },
} satisfies Record<string, React.CSSProperties>
