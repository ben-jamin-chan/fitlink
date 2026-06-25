import React, { useEffect, useState } from 'react'

import { onAuthStateChanged } from 'firebase/auth'
import { Navigate } from 'react-router-dom'

import { auth } from '../firebase'

interface AdminRouteProps {
  children: React.ReactNode
}

type ClaimStatus = 'loading' | 'authorised' | 'unauthorised'

export const AdminRoute = ({ children }: AdminRouteProps): React.JSX.Element => {
  const [status, setStatus] = useState<ClaimStatus>('loading')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus('unauthorised')
        return
      }

      try {
        const tokenResult = await user.getIdTokenResult(false)
        const isAdmin = tokenResult.claims['admin'] === true
        setStatus(isAdmin ? 'authorised' : 'unauthorised')
      } catch {
        setStatus('unauthorised')
      }
    })

    return unsubscribe
  }, [])

  if (status === 'loading') {
    return (
      <div style={styles.fullPageStatus}>
        <p style={styles.statusText}>Verifying access...</p>
      </div>
    )
  }

  if (status === 'unauthorised') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

const styles = {
  fullPageStatus: {
    alignItems: 'center',
    display: 'flex',
    height: '100vh',
    justifyContent: 'center',
  },
  statusText: {
    color: '#4b5563',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '14px',
    margin: 0,
  },
} satisfies Record<string, React.CSSProperties>
