import React, { useEffect, useState } from 'react'

import { onAuthStateChanged, signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'

import { auth } from '../firebase'

type TabName = 'Reports' | 'Flags' | 'Users'

const TABS: TabName[] = ['Reports', 'Flags', 'Users']

export const DashboardPage = (): React.JSX.Element => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabName>('Reports')
  const [adminEmail, setAdminEmail] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.email) {
        setAdminEmail(user.email)
      }
    })

    return unsubscribe
  }, [])

  const handleSignOut = async (): Promise<void> => {
    await signOut(auth)
    navigate('/', { replace: true })
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.brand}>Fitlink Admin</span>
        <div style={styles.headerActions}>
          <span style={styles.email}>{adminEmail}</span>
          <button
            onClick={() => {
              void handleSignOut()
            }}
            style={styles.signOutButton}
            type="button"
          >
            Sign Out
          </button>
        </div>
      </header>

      <nav aria-label="Moderation sections" style={styles.tabs}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab

          return (
            <button
              aria-pressed={isActive}
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={isActive ? styles.activeTabButton : styles.tabButton}
              type="button"
            >
              {tab}
            </button>
          )
        })}
      </nav>

      <main style={styles.main}>
        <p style={styles.panelText}>{activeTab} panel - coming in Task 95</p>
      </main>
    </div>
  )
}

const baseTabStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  padding: '12px 20px',
}

const styles = {
  page: {
    backgroundColor: '#f9fafb',
    fontFamily: 'system-ui, sans-serif',
    minHeight: '100vh',
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    height: '56px',
    justifyContent: 'space-between',
    padding: '0 24px',
  },
  brand: {
    color: '#111827',
    fontSize: '18px',
    fontWeight: 700,
  },
  headerActions: {
    alignItems: 'center',
    display: 'flex',
    gap: '16px',
  },
  email: {
    color: '#6b7280',
    fontSize: '14px',
  },
  signOutButton: {
    background: 'none',
    border: 'none',
    color: '#dc2626',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  tabs: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    gap: 0,
    padding: '0 24px',
  },
  tabButton: {
    ...baseTabStyle,
    borderBottom: '2px solid transparent',
    color: '#6b7280',
    fontWeight: 400,
  },
  activeTabButton: {
    ...baseTabStyle,
    borderBottom: '2px solid #1a73e8',
    color: '#1a73e8',
    fontWeight: 600,
  },
  main: {
    padding: '32px 24px',
  },
  panelText: {
    color: '#9ca3af',
    fontSize: '14px',
    margin: 0,
  },
} satisfies Record<string, React.CSSProperties>
