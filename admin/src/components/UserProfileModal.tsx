import React, { useEffect, useState } from 'react'

import { doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'

import { db, functions } from '../firebase'

type AdminAction = 'ban' | 'unban'

interface AdminActionRequest {
  action: AdminAction
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

interface UserProfile {
  firstName: string
  email: string
  bio: string
  photos: string[]
  banned: boolean
  premium?: {
    tier: string
    active: boolean
  }
  activities: string[]
  fitnessLevel: string
  createdAt: FirestoreTimestamp | null
}

interface UserProfileModalProps {
  userId: string
  onClose: () => void
  onBanToggle: (userId: string, banned: boolean) => void
}

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

const readStringArray = (
  data: Record<string, unknown>,
  key: string
): string[] => {
  const value = data[key]

  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
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

const readPremium = (
  data: Record<string, unknown>
): UserProfile['premium'] => {
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

const toUserProfile = (data: Record<string, unknown>): UserProfile => {
  return {
    firstName: readString(data, 'firstName', 'Unknown user'),
    email: readString(data, 'email', 'Not provided'),
    bio: readString(data, 'bio', ''),
    photos: readStringArray(data, 'photos'),
    banned: readBoolean(data, 'banned', false),
    premium: readPremium(data),
    activities: readStringArray(data, 'activities'),
    fitnessLevel: readString(data, 'fitnessLevel', ''),
    createdAt: readTimestamp(data, 'createdAt'),
  }
}

const formatDate = (timestamp: FirestoreTimestamp | null): string => {
  if (timestamp === null) {
    return 'N/A'
  }

  return new Date(timestamp.seconds * 1000).toLocaleDateString()
}

export const UserProfileModal = ({
  userId,
  onClose,
  onBanToggle,
}: UserProfileModalProps): React.JSX.Element => {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProfile = async (): Promise<void> => {
      setLoading(true)
      setError(null)

      try {
        const snapshot = await getDoc(doc(db, 'users', userId))

        if (!snapshot.exists()) {
          setError('User not found.')
          return
        }

        setProfile(toUserProfile(snapshot.data()))
      } catch {
        setError('Failed to load profile.')
      } finally {
        setLoading(false)
      }
    }

    void fetchProfile()
  }, [userId])

  const handleBanToggle = async (): Promise<void> => {
    if (profile === null) {
      return
    }

    const action: AdminAction = profile.banned ? 'unban' : 'ban'
    const actionLabel = profile.banned ? 'Unban' : 'Ban'
    const confirmed = window.confirm(
      profile.banned
        ? `Unban ${profile.firstName}?`
        : `Ban ${profile.firstName}? This will hide them from discovery.`
    )

    if (!confirmed) {
      return
    }

    setActionLoading(true)

    try {
      await adminActionFn({
        action,
        targetId: userId,
        reason: `Admin panel ${action}`,
        sourceCollection: 'reports',
        sourceDocId: 'direct',
      })

      const banned = !profile.banned
      setProfile({ ...profile, banned })
      onBanToggle(userId, banned)
    } catch {
      window.alert(`${actionLabel} failed. Please try again.`)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div onClick={onClose} style={styles.overlay}>
      <section
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        style={styles.modal}
      >
        <button onClick={onClose} style={styles.closeButton} type="button">
          Close
        </button>

        {loading && <p style={styles.mutedText}>Loading profile...</p>}
        {error !== null && <p style={styles.errorText}>{error}</p>}

        {profile !== null && (
          <>
            <h2 style={styles.title}>{profile.firstName}</h2>
            <p style={styles.metaText}>ID: {userId}</p>
            <p style={styles.metaText}>Email: {profile.email}</p>
            <p style={styles.metaText}>Joined: {formatDate(profile.createdAt)}</p>

            <div style={styles.badges}>
              <span
                style={
                  profile.banned ? styles.bannedBadge : styles.activeBadge
                }
              >
                {profile.banned ? 'Banned' : 'Active'}
              </span>
              {profile.premium?.active === true && (
                <span style={styles.premiumBadge}>
                  {profile.premium.tier.toUpperCase()}
                </span>
              )}
            </div>

            {profile.photos.length > 0 && (
              <div style={styles.photoGrid}>
                {profile.photos.map((url) => (
                  <img
                    alt={`${profile.firstName} profile`}
                    key={url}
                    src={url}
                    style={styles.profilePhoto}
                  />
                ))}
              </div>
            )}

            {profile.bio.length > 0 && (
              <section style={styles.section}>
                <strong style={styles.sectionTitle}>Bio</strong>
                <p style={styles.bodyText}>{profile.bio}</p>
              </section>
            )}

            {profile.activities.length > 0 && (
              <section style={styles.section}>
                <strong style={styles.sectionTitle}>Activities</strong>
                <p style={styles.bodyText}>{profile.activities.join(', ')}</p>
              </section>
            )}

            {profile.fitnessLevel.length > 0 && (
              <section style={styles.section}>
                <strong style={styles.sectionTitle}>Fitness Level</strong>
                <p style={styles.bodyText}>{profile.fitnessLevel}</p>
              </section>
            )}

            <button
              disabled={actionLoading}
              onClick={() => {
                void handleBanToggle()
              }}
              style={
                profile.banned ? styles.unbanButton : styles.banButton
              }
              type="button"
            >
              {actionLoading
                ? 'Processing...'
                : profile.banned
                  ? 'Unban User'
                  : 'Ban User'}
            </button>
          </>
        )}
      </section>
    </div>
  )
}

const baseBadgeStyle: React.CSSProperties = {
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 700,
  padding: '4px 10px',
}

const baseActionButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: '6px',
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 700,
  padding: '10px 20px',
  width: '100%',
}

const styles = {
  overlay: {
    alignItems: 'center',
    background: 'rgba(17, 24, 39, 0.62)',
    display: 'flex',
    inset: 0,
    justifyContent: 'center',
    padding: '24px',
    position: 'fixed',
    zIndex: 500,
  },
  modal: {
    background: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 20px 48px rgba(17, 24, 39, 0.22)',
    maxHeight: '90vh',
    maxWidth: '95vw',
    overflowY: 'auto',
    padding: '24px',
    position: 'relative',
    width: '560px',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    position: 'absolute',
    right: '18px',
    top: '18px',
  },
  title: {
    color: '#111827',
    fontSize: '24px',
    margin: '0 80px 8px 0',
  },
  metaText: {
    color: '#6b7280',
    fontSize: '13px',
    margin: '0 0 6px',
  },
  mutedText: {
    color: '#6b7280',
    fontSize: '14px',
    margin: 0,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: '14px',
    margin: 0,
  },
  badges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    margin: '16px 0',
  },
  activeBadge: {
    ...baseBadgeStyle,
    background: '#dcfce7',
    color: '#166534',
  },
  bannedBadge: {
    ...baseBadgeStyle,
    background: '#fee2e2',
    color: '#991b1b',
  },
  premiumBadge: {
    ...baseBadgeStyle,
    background: '#fef3c7',
    color: '#92400e',
  },
  photoGrid: {
    display: 'grid',
    gap: '8px',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    marginBottom: '16px',
  },
  profilePhoto: {
    aspectRatio: '1',
    borderRadius: '6px',
    objectFit: 'cover',
    width: '100%',
  },
  section: {
    marginBottom: '14px',
  },
  sectionTitle: {
    color: '#111827',
    display: 'block',
    fontSize: '13px',
    marginBottom: '4px',
  },
  bodyText: {
    color: '#374151',
    fontSize: '14px',
    lineHeight: 1.5,
    margin: 0,
  },
  banButton: {
    ...baseActionButtonStyle,
    backgroundColor: '#dc2626',
  },
  unbanButton: {
    ...baseActionButtonStyle,
    backgroundColor: '#16a34a',
  },
} satisfies Record<string, React.CSSProperties>
