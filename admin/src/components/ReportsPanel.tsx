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
  sourceCollection: 'reports'
  sourceDocId: string
}

interface AdminActionResponse {
  success: boolean
}

interface FirestoreTimestamp {
  seconds: number
}

interface ReportDoc {
  id: string
  reportedUserId: string
  reporterId: string
  reason: string
  details: string
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

const toReportDoc = (
  snapshot: QueryDocumentSnapshot<DocumentData>
): ReportDoc => {
  const data = snapshot.data()

  return {
    id: snapshot.id,
    reportedUserId: readString(data, 'reportedUserId', ''),
    reporterId: readString(data, 'reporterId', ''),
    reason: readString(data, 'reason', 'Unspecified'),
    details: readString(data, 'details', ''),
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

export const ReportsPanel = (): React.JSX.Element => {
  const [reports, setReports] = useState<ReportDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  )

  const fetchReports = async (
    after?: QueryDocumentSnapshot<DocumentData>
  ): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const baseQuery = query(
        collection(db, 'reports'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      )
      const reportsQuery =
        after === undefined ? baseQuery : query(baseQuery, startAfter(after))
      const snapshot = await getDocs(reportsQuery)
      const docs = snapshot.docs.map(toReportDoc)

      setReports((current) => (after === undefined ? docs : [...current, ...docs]))
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null)
      setHasMore(snapshot.docs.length === PAGE_SIZE)
    } catch {
      setError('Failed to load reports.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchReports()
  }, [])

  const handleAction = async (
    report: ReportDoc,
    action: QueueAction
  ): Promise<void> => {
    if (report.reportedUserId.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'This report is missing a reported user ID.',
      })
      return
    }

    setActionLoading(report.id)
    setStatusMessage(null)

    try {
      await adminActionFn({
        action,
        targetId: report.reportedUserId,
        reason: report.reason,
        sourceCollection: 'reports',
        sourceDocId: report.id,
      })
      setReports((current) => current.filter((item) => item.id !== report.id))
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

  if (loading && reports.length === 0) {
    return <p style={styles.panelStatus}>Loading reports...</p>
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

      {reports.length === 0 ? (
        <p style={styles.panelStatus}>No pending reports.</p>
      ) : (
        <>
          <div style={styles.tableScroller}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.headerRow}>
                  <th style={styles.headerCell}>Reported User</th>
                  <th style={styles.headerCell}>Reporter</th>
                  <th style={styles.headerCell}>Reason</th>
                  <th style={styles.headerCell}>Details</th>
                  <th style={styles.headerCell}>Date</th>
                  <th style={styles.headerCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} style={styles.bodyRow}>
                    <td style={styles.bodyCell}>
                      <button
                        disabled={report.reportedUserId.length === 0}
                        onClick={() => setSelectedUserId(report.reportedUserId)}
                        style={styles.linkButton}
                        type="button"
                      >
                        {report.reportedUserId || 'Missing user ID'}
                      </button>
                    </td>
                    <td style={styles.monoCell}>
                      {report.reporterId || 'N/A'}
                    </td>
                    <td style={styles.bodyCell}>{report.reason}</td>
                    <td style={styles.bodyCell}>{report.details || 'N/A'}</td>
                    <td style={styles.bodyCell}>
                      {formatDate(report.createdAt)}
                    </td>
                    <td style={styles.actionCell}>
                      <button
                        disabled={actionLoading === report.id}
                        onClick={() => {
                          void handleAction(report, 'ban')
                        }}
                        style={styles.banButton}
                        type="button"
                      >
                        Ban
                      </button>
                      <button
                        disabled={actionLoading === report.id}
                        onClick={() => {
                          void handleAction(report, 'warn')
                        }}
                        style={styles.warnButton}
                        type="button"
                      >
                        Warn
                      </button>
                      <button
                        disabled={actionLoading === report.id}
                        onClick={() => {
                          void handleAction(report, 'dismiss')
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
                void fetchReports(lastDoc ?? undefined)
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
    minWidth: '960px',
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
    verticalAlign: 'top',
  },
  monoCell: {
    color: '#374151',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '12px',
    padding: '10px 12px',
    verticalAlign: 'top',
  },
  actionCell: {
    display: 'flex',
    gap: '8px',
    padding: '10px 12px',
    verticalAlign: 'top',
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
