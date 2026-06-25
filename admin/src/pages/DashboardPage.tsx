import React, { useEffect, useState } from 'react'

import {
  collection,
  getCountFromServer,
  query,
  where,
} from 'firebase/firestore'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'

import { auth, db } from '../firebase'
import { FlagsPanel } from '../components/FlagsPanel'
import { ReportsPanel } from '../components/ReportsPanel'
import { UsersPanel } from '../components/UsersPanel'

type TabName = 'Reports' | 'Flags' | 'Users'

const TABS: TabName[] = ['Reports', 'Flags', 'Users']

interface BadgeCounts {
  Reports: number
  Flags: number
}

export const DashboardPage = (): React.JSX.Element => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabName>('Reports')
  const [adminEmail, setAdminEmail] = useState('')
  const [badgeCounts, setBadgeCounts] = useState<BadgeCounts>({
    Reports: 0,
    Flags: 0,
  })

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.email) {
        setAdminEmail(user.email)
      }
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    const fetchBadgeCounts = async (): Promise<void> => {
      try {
        const [reportsSnapshot, flagsSnapshot] = await Promise.all([
          getCountFromServer(
            query(collection(db, 'reports'), where('status', '==', 'pending'))
          ),
          getCountFromServer(
            query(collection(db, 'flags'), where('status', '==', 'pending'))
          ),
        ])

        setBadgeCounts({
          Reports: reportsSnapshot.data().count,
          Flags: flagsSnapshot.data().count,
        })
      } catch {
        setBadgeCounts({ Reports: 0, Flags: 0 })
      }
    }

    void fetchBadgeCounts()
  }, [])

  const handleSignOut = async (): Promise<void> => {
    await signOut(auth)
    navigate('/', { replace: true })
  }

  const renderActivePanel = (): React.JSX.Element => {
    if (activeTab === 'Reports') {
      return <ReportsPanel />
    }

    if (activeTab === 'Flags') {
      return <FlagsPanel />
    }

    return <UsersPanel />
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
              {tab !== 'Users' && badgeCounts[tab] > 0 && (
                <span style={styles.badge}>{badgeCounts[tab]}</span>
              )}
            </button>
          )
        })}
      </nav>

      <main style={styles.main}>{renderActivePanel()}</main>
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
    minHeight: 'calc(100vh - 105px)',
  },
  badge: {
    backgroundColor: '#dc2626',
    borderRadius: '999px',
    color: '#ffffff',
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 700,
    lineHeight: 1,
    marginLeft: '8px',
    minWidth: '18px',
    padding: '3px 6px',
    textAlign: 'center',
  },
} satisfies Record<string, React.CSSProperties>
