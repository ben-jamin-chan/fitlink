import React, { useEffect, useMemo, useState } from 'react'

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'

import { db, functions } from '../firebase'
import { UserProfileModal } from './UserProfileModal'

interface AdminActionRequest {
  action: 'ban'
  targetId: string
  reason: string
  sourceCollection: 'reports'
  sourceDocId: 'direct'
}

interface AdminActionResponse {
  success: boolean
}

interface FirestoreTimestamp {
  seconds: number
}

interface UserRow {
  id: string
  firstName: string
  email: string
  banned: boolean
  premium?: {
    tier: string
    active: boolean
  }
  createdAt: FirestoreTimestamp | null
}

interface StatusMessage {
  type: 'success' | 'error'
  text: string
}

const PAGE_SIZE = 20

const adminActionFn = httpsCallable<AdminActionRequest, AdminActionResponse>(
  functions,
  'adminAction'
)

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const readString = (
  data: Record<string, unknown>,
  key: string,
  fallback: string
): string => {
  const value = data[key]
  return typeof value === 'string' ? value : fallback
}

const readBoolean = (
  data: Record<string, unknown>,
  key: string,
  fallback: boolean
): boolean => {
  const value = data[key]
  return typeof value === 'boolean' ? value : fallback
}

const readTimestamp = (
  data: Record<string, unknown>,
  key: string
): FirestoreTimestamp | null => {
  const value = data[key]

  if (!isRecord(value) || typeof value.seconds !== 'number') {
    return null
  }

  return { seconds: value.seconds }
}

const readPremium = (data: Record<string, unknown>): UserRow['premium'] => {
  const value = data.premium

  if (!isRecord(value)) {
    return undefined
  }

  const tier = value.tier
  const active = value.active

  if (typeof tier !== 'string' || typeof active !== 'boolean') {
    return undefined
  }

  return { tier, active }
}

const toUserRow = (snapshot: QueryDocumentSnapshot<DocumentData>): UserRow => {
  const data = snapshot.data()

  return {
    id: snapshot.id,
    firstName: readString(data, 'firstName', 'Unknown user'),
    email: readString(data, 'email', 'Not provided'),
    banned: readBoolean(data, 'banned', false),
    premium: readPremium(data),
    createdAt: readTimestamp(data, 'createdAt'),
  }
}

const formatDate = (timestamp: FirestoreTimestamp | null): string => {
  if (timestamp === null) {
    return 'N/A'
  }

  return new Date(timestamp.seconds * 1000).toLocaleDateString()
}

export const UsersPanel = (): React.JSX.Element => {
  const [users, setUsers] = useState<UserRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  )

  const visibleUsers = useMemo(() => {
    const term = search.toLowerCase().trim()

    if (term.length === 0) {
      return users
    }

    return users.filter((user) =>
      user.firstName.toLowerCase().startsWith(term)
    )
  }, [search, users])

  const fetchUsers = async (
    after?: QueryDocumentSnapshot<DocumentData>
  ): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const baseQuery = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      )
      const usersQuery =
        after === undefined ? baseQuery : query(baseQuery, startAfter(after))
      const snapshot = await getDocs(usersQuery)
      const docs = snapshot.docs.map(toUserRow)

      setUsers((current) => (after === undefined ? docs : [...current, ...docs]))
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null)
      setHasMore(snapshot.docs.length === PAGE_SIZE)
    } catch {
      setError('Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchUsers()
  }, [])

  const updateUserBannedState = (userId: string, banned: boolean): void => {
    setUsers((current) =>
      current.map((user) =>
        user.id === userId ? { ...user, banned } : user
      )
    )
  }

  const handleBan = async (user: UserRow): Promise<void> => {
    const confirmed = window.confirm(
      `Ban ${user.firstName}? This will hide them from discovery.`
    )

    if (!confirmed) {
      return
    }

    setActionLoading(user.id)
    setStatusMessage(null)

    try {
      await adminActionFn({
        action: 'ban',
        targetId: user.id,
        reason: 'Admin panel direct ban',
        sourceCollection: 'reports',
        sourceDocId: 'direct',
      })
      updateUserBannedState(user.id, true)
      setStatusMessage({
        type: 'success',
        text: `${user.firstName} has been banned.`,
      })
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Ban failed. Please try again.',
      })
    } finally {
      setActionLoading(null)
    }
  }

  if (loading && users.length === 0) {
    return <p style={styles.panelStatus}>Loading users...</p>
  }

  if (error !== null) {
    return <p style={styles.errorText}>{error}</p>
  }

  return (
    <section style={styles.panel}>
      {selectedUserId !== null && (
        <UserProfileModal
          onBanToggle={updateUserBannedState}
          onClose={() => setSelectedUserId(null)}
          userId={selectedUserId}
        />
      )}

      {statusMessage !== null && (
        <p
          style={
            statusMessage.type === 'success'
              ? styles.successToast
              : styles.errorToast
          }
        >
          {statusMessage.text}
        </p>
      )}

      <div style={styles.toolbar}>
        <input
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter by first name (current page only)"
          style={styles.searchInput}
          type="text"
          value={search}
        />
        <span style={styles.searchNote}>
          Showing fetched users only. Full search is deferred to Phase 5.
        </span>
      </div>

      <div style={styles.tableScroller}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.headerRow}>
              <th style={styles.headerCell}>Name</th>
              <th style={styles.headerCell}>Email</th>
              <th style={styles.headerCell}>Premium</th>
              <th style={styles.headerCell}>Banned</th>
              <th style={styles.headerCell}>Joined</th>
              <th style={styles.headerCell}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((user) => (
              <tr
                key={user.id}
                onClick={() => setSelectedUserId(user.id)}
                style={styles.bodyRow}
              >
                <td style={styles.bodyCell}>{user.firstName}</td>
                <td style={styles.bodyCell}>{user.email}</td>
                <td style={styles.bodyCell}>
                  {user.premium?.active === true ? user.premium.tier : 'free'}
                </td>
                <td style={styles.bodyCell}>
                  {user.banned ? (
                    <span style={styles.bannedText}>Yes</span>
                  ) : (
                    'No'
                  )}
                </td>
                <td style={styles.bodyCell}>{formatDate(user.createdAt)}</td>
                <td
                  onClick={(event) => event.stopPropagation()}
                  style={styles.actionCell}
                >
                  {!user.banned && (
                    <button
                      disabled={actionLoading === user.id}
                      onClick={() => {
                        void handleBan(user)
                      }}
                      style={styles.banButton}
                      type="button"
                    >
                      Ban
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visibleUsers.length === 0 && (
        <p style={styles.emptyText}>No users match this filter.</p>
      )}

      {hasMore && (
        <button
          disabled={loading}
          onClick={() => {
            void fetchUsers(lastDoc ?? undefined)
          }}
          style={styles.loadMoreButton}
          type="button"
        >
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </section>
  )
}

const styles = {
  panel: {
    padding: '24px',
  },
  panelStatus: {
    color: '#6b7280',
    fontSize: '14px',
    margin: '0',
    padding: '24px',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: '14px',
    margin: '0',
    padding: '24px',
  },
  successToast: {
    backgroundColor: '#dcfce7',
    border: '1px solid #86efac',
    borderRadius: '6px',
    color: '#166534',
    fontSize: '14px',
    margin: '0 0 16px',
    padding: '10px 12px',
  },
  errorToast: {
    backgroundColor: '#fee2e2',
    border: '1px solid #fca5a5',
    borderRadius: '6px',
    color: '#991b1b',
    fontSize: '14px',
    margin: '0 0 16px',
    padding: '10px 12px',
  },
  toolbar: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '16px',
  },
  searchInput: {
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    padding: '8px 10px',
    width: '300px',
  },
  searchNote: {
    color: '#6b7280',
    fontSize: '12px',
  },
  tableScroller: {
    overflowX: 'auto',
  },
  table: {
    backgroundColor: '#ffffff',
    borderCollapse: 'collapse',
    borderRadius: '8px',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
    fontSize: '14px',
    minWidth: '920px',
    width: '100%',
  },
  headerRow: {
    borderBottom: '1px solid #d1d5db',
    textAlign: 'left',
  },
  headerCell: {
    color: '#374151',
    fontSize: '12px',
    fontWeight: 700,
    padding: '10px 12px',
    textTransform: 'uppercase',
  },
  bodyRow: {
    borderBottom: '1px solid #e5e7eb',
    cursor: 'pointer',
  },
  bodyCell: {
    color: '#374151',
    padding: '10px 12px',
    verticalAlign: 'middle',
  },
  actionCell: {
    padding: '10px 12px',
    verticalAlign: 'middle',
  },
  bannedText: {
    color: '#b91c1c',
    fontWeight: 700,
  },
  banButton: {
    backgroundColor: '#dc2626',
    border: 'none',
    borderRadius: '4px',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    padding: '6px 10px',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: '14px',
    margin: '16px 0 0',
  },
  loadMoreButton: {
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    color: '#111827',
    cursor: 'pointer',
    fontSize: '14px',
    marginTop: '16px',
    padding: '8px 14px',
  },
} satisfies Record<string, React.CSSProperties>
