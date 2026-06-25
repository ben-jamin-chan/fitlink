import React, { useEffect, useState } from 'react'

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'

import { db, functions } from '../firebase'
import { UserProfileModal } from './UserProfileModal'

type QueueAction = 'ban' | 'warn' | 'dismiss'

interface AdminActionRequest {
  action: QueueAction
  targetId: string
  reason: string
  sourceCollection: 'flags'
  sourceDocId: string
}

interface AdminActionResponse {
  success: boolean
}

interface FirestoreTimestamp {
  seconds: number
}

interface FlagDoc {
  id: string
  targetUserId: string
  photoUrl: string
  reason: string
  createdAt: FirestoreTimestamp | null
}

interface StatusMessage {
  type: 'success' | 'error'
  text: string
}

const PAGE_SIZE = 50

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

const toFlagDoc = (snapshot: QueryDocumentSnapshot<DocumentData>): FlagDoc => {
  const data = snapshot.data()
  const targetUserId =
    readString(data, 'reportedUserId', '') || readString(data, 'userId', '')

  return {
    id: snapshot.id,
    targetUserId,
    photoUrl: readString(data, 'photoUrl', ''),
    reason: readString(data, 'reason', 'Unspecified'),
    createdAt: readTimestamp(data, 'createdAt'),
  }
}

const formatDate = (timestamp: FirestoreTimestamp | null): string => {
  if (timestamp === null) {
    return 'N/A'
  }

  return new Date(timestamp.seconds * 1000).toLocaleDateString()
}

const actionLabel = (action: QueueAction): string => {
  if (action === 'ban') {
    return 'Ban'
  }

  if (action === 'warn') {
    return 'Warn'
  }

  return 'Dismiss'
}

export const FlagsPanel = (): React.JSX.Element => {
  const [flags, setFlags] = useState<FlagDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [expandedPhotoUrl, setExpandedPhotoUrl] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  )

  const fetchFlags = async (
    after?: QueryDocumentSnapshot<DocumentData>
  ): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const baseQuery = query(
        collection(db, 'flags'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      )
      const flagsQuery =
        after === undefined ? baseQuery : query(baseQuery, startAfter(after))
      const snapshot = await getDocs(flagsQuery)
      const docs = snapshot.docs.map(toFlagDoc)

      setFlags((current) => (after === undefined ? docs : [...current, ...docs]))
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null)
      setHasMore(snapshot.docs.length === PAGE_SIZE)
    } catch {
      setError('Failed to load flags.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchFlags()
  }, [])

  const handleAction = async (
    flag: FlagDoc,
    action: QueueAction
  ): Promise<void> => {
    if (flag.targetUserId.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'This flag is missing a user ID.',
      })
      return
    }

    setActionLoading(flag.id)
    setStatusMessage(null)

    try {
      await adminActionFn({
        action,
        targetId: flag.targetUserId,
        reason: flag.reason,
        sourceCollection: 'flags',
        sourceDocId: flag.id,
      })
      setFlags((current) => current.filter((item) => item.id !== flag.id))
      setStatusMessage({
        type: 'success',
        text: `${actionLabel(action)} action completed.`,
      })
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Action failed. Please try again.',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleModalBanToggle = (): void => {}

  if (loading && flags.length === 0) {
    return <p style={styles.panelStatus}>Loading flags...</p>
  }

  if (error !== null) {
    return <p style={styles.errorText}>{error}</p>
  }

  return (
    <section style={styles.panel}>
      {selectedUserId !== null && (
        <UserProfileModal
          onBanToggle={handleModalBanToggle}
          onClose={() => setSelectedUserId(null)}
          userId={selectedUserId}
        />
      )}

      {expandedPhotoUrl !== null && (
        <button
          aria-label="Close expanded flagged photo"
          onClick={() => setExpandedPhotoUrl(null)}
          style={styles.photoOverlay}
          type="button"
        >
          <img
            alt="Expanded flagged content"
            src={expandedPhotoUrl}
            style={styles.expandedPhoto}
          />
        </button>
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

      {flags.length === 0 ? (
        <p style={styles.panelStatus}>No pending flags.</p>
      ) : (
        <>
          <div style={styles.tableScroller}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.headerRow}>
                  <th style={styles.headerCell}>Photo</th>
                  <th style={styles.headerCell}>Flagged User</th>
                  <th style={styles.headerCell}>Reason</th>
                  <th style={styles.headerCell}>Date</th>
                  <th style={styles.headerCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((flag) => (
                  <tr key={flag.id} style={styles.bodyRow}>
                    <td style={styles.bodyCell}>
                      {flag.photoUrl.length > 0 ? (
                        <button
                          onClick={() => setExpandedPhotoUrl(flag.photoUrl)}
                          style={styles.thumbnailButton}
                          type="button"
                        >
                          <img
                            alt="Flagged content thumbnail"
                            src={flag.photoUrl}
                            style={styles.thumbnail}
                          />
                        </button>
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td style={styles.bodyCell}>
                      <button
                        disabled={flag.targetUserId.length === 0}
                        onClick={() => setSelectedUserId(flag.targetUserId)}
                        style={styles.linkButton}
                        type="button"
                      >
                        {flag.targetUserId || 'Missing user ID'}
                      </button>
                    </td>
                    <td style={styles.bodyCell}>{flag.reason}</td>
                    <td style={styles.bodyCell}>{formatDate(flag.createdAt)}</td>
                    <td style={styles.actionCell}>
                      <button
                        disabled={actionLoading === flag.id}
                        onClick={() => {
                          void handleAction(flag, 'ban')
                        }}
                        style={styles.banButton}
                        type="button"
                      >
                        Ban
                      </button>
                      <button
                        disabled={actionLoading === flag.id}
                        onClick={() => {
                          void handleAction(flag, 'warn')
                        }}
                        style={styles.warnButton}
                        type="button"
                      >
                        Warn
                      </button>
                      <button
                        disabled={actionLoading === flag.id}
                        onClick={() => {
                          void handleAction(flag, 'dismiss')
                        }}
                        style={styles.dismissButton}
                        type="button"
                      >
                        Dismiss
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <button
              disabled={loading}
              onClick={() => {
                void fetchFlags(lastDoc ?? undefined)
              }}
              style={styles.loadMoreButton}
              type="button"
            >
              {loading ? 'Loading...' : 'Load more'}
            </button>
          )}
        </>
      )}
    </section>
  )
}

const baseButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: '4px',
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
  padding: '6px 10px',
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
  tableScroller: {
    overflowX: 'auto',
  },
  table: {
    backgroundColor: '#ffffff',
    borderCollapse: 'collapse',
    borderRadius: '8px',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
    fontSize: '14px',
    minWidth: '820px',
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
  },
  bodyCell: {
    color: '#374151',
    padding: '10px 12px',
    verticalAlign: 'middle',
  },
  actionCell: {
    display: 'flex',
    gap: '8px',
    padding: '10px 12px',
    verticalAlign: 'middle',
  },
  thumbnailButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  thumbnail: {
    borderRadius: '4px',
    height: '52px',
    objectFit: 'cover',
    width: '52px',
  },
  photoOverlay: {
    alignItems: 'center',
    background: 'rgba(17, 24, 39, 0.82)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    inset: 0,
    justifyContent: 'center',
    padding: '24px',
    position: 'fixed',
    zIndex: 1000,
  },
  expandedPhoto: {
    borderRadius: '8px',
    maxHeight: '90vh',
    maxWidth: '90vw',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    cursor: 'pointer',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '12px',
    padding: 0,
    textAlign: 'left',
  },
  banButton: {
    ...baseButtonStyle,
    backgroundColor: '#dc2626',
  },
  warnButton: {
    ...baseButtonStyle,
    backgroundColor: '#d97706',
  },
  dismissButton: {
    ...baseButtonStyle,
    backgroundColor: '#6b7280',
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
