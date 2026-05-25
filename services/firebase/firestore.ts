import {
  Timestamp,
  arrayRemove,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import type { FieldValue } from 'firebase/firestore'

import { db } from '@/services/firebase/config'

import type { Match } from '@/types/match'
import type { PremiumStatus } from '@/types/subscription'
import type { LookingFor, UserProfile } from '@/types/user'

const FIRESTORE_WRITE_TIMEOUT_MS = 20000
const DAILY_LIKE_CAP = 50

const sortMatchesByActivity = (first: Match, second: Match): number => {
  const firstLastMessageAt =
    first.lastMessageAt instanceof Timestamp
      ? first.lastMessageAt.toMillis()
      : null
  const secondLastMessageAt =
    second.lastMessageAt instanceof Timestamp
      ? second.lastMessageAt.toMillis()
      : null

  if (firstLastMessageAt === null && secondLastMessageAt === null) {
    return 0
  }

  if (firstLastMessageAt === null) {
    return -1
  }

  if (secondLastMessageAt === null) {
    return 1
  }

  return secondLastMessageAt - firstLastMessageAt
}

interface CreateUserProfileInput {
  uid: string
  firstName: string
  dateOfBirth: Date
  gender: UserProfile['gender']
  location: UserProfile['location']
  photos: string[]
  bio: string
  height: number
  religion?: string
  activities: string[]
  fitnessLevel: UserProfile['fitnessLevel']
  workoutFrequency: string
  dietaryPreference: string
  fitnessGoals: string[]
  smoking: UserProfile['smoking']
  drinking: UserProfile['drinking']
  lookingFor: LookingFor[]
  preferences: UserProfile['preferences']
  language: string
}

export type UserProfileUpdateInput = Partial<
  Omit<
    UserProfile,
    | 'uid'
    | 'age'
    | 'stats'
    | 'premium'
    | 'banned'
    | 'photoVerified'
    | 'verifiedAt'
    | 'stripeCustomerId'
    | 'createdAt'
    | 'lastActive'
  >
> & {
  lastActive?: UserProfile['lastActive'] | FieldValue
}

const withWriteTimeout = async (operation: Promise<void>): Promise<void> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<void>((_, reject): void => {
    timeoutId = setTimeout((): void => {
      reject(new Error('firestore-write-timeout'))
    }, FIRESTORE_WRITE_TIMEOUT_MS)
  })

  try {
    await Promise.race([operation, timeout])
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}

export const createUserProfile = async (
  input: CreateUserProfileInput
): Promise<void> => {
  const userRef = doc(db, 'users', input.uid)

  const profileData = {
    uid: input.uid,
    firstName: input.firstName,
    dateOfBirth: Timestamp.fromDate(input.dateOfBirth),
    // CRITICAL: age is intentionally omitted. Task 22 calculates it server-side.
    gender: input.gender,
    location: input.location,
    photos: input.photos,
    bio: input.bio,
    height: input.height,
    ...(input.religion !== undefined && input.religion !== ''
      ? { religion: input.religion }
      : {}),
    activities: input.activities,
    fitnessLevel: input.fitnessLevel,
    workoutFrequency: input.workoutFrequency,
    dietaryPreference: input.dietaryPreference,
    fitnessGoals: input.fitnessGoals,
    smoking: input.smoking,
    drinking: input.drinking,
    lookingFor: input.lookingFor,
    preferences: input.preferences,
    stats: { likes: 0, passes: 0, matches: 0 },
    premium: {
      active: false,
      tier: null,
      subscriptionId: null,
      expiresAt: null,
    } satisfies PremiumStatus,
    photoVerified: false,
    paused: false,
    banned: false,
    language: input.language,
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp(),
  }

  await withWriteTimeout(setDoc(userRef, profileData))
}

export const updateUserProfile = async (
  userId: string,
  data: UserProfileUpdateInput
): Promise<void> => {
  const userRef = doc(db, 'users', userId)

  // updateDoc accepts a plain object subset; this cast is safe because the
  // input type excludes server-controlled user profile fields.
  await withWriteTimeout(updateDoc(userRef, data as Record<string, unknown>))
}

/**
 * Removes a photo URL from the /users/{userId} photos array.
 * Uses Firestore arrayRemove so no read-modify-write is needed.
 */
export const removePhotoFromProfile = async (
  userId: string,
  photoUrl: string
): Promise<void> => {
  const userRef = doc(db, 'users', userId)

  await withWriteTimeout(
    updateDoc(userRef, {
      photos: arrayRemove(photoUrl),
    })
  )
}

/**
 * Fetch a single user profile by UID.
 * Returns null if the document does not exist.
 */
export const getUserProfile = async (
  uid: string
): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, 'users', uid))

  if (!snap.exists()) {
    return null
  }

  // Firestore returns untyped document data; users/{uid} is guarded by schema
  // and security rules, so this is the service boundary cast.
  return snap.data() as UserProfile
}

/**
 * Subscribe to all matches for a given userId.
 * Calls onUpdate every time the collection changes.
 * Returns an Unsubscribe function; call it on cleanup.
 *
 * Firestore composite index required:
 * Collection: matches
 * Fields: users (Array) ASC, lastMessageAt DESC
 */
export const subscribeToMatches = (
  userId: string,
  onUpdate: (matches: Match[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  const matchesQuery = query(
    collection(db, 'matches'),
    where('users', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc')
  )

  return onSnapshot(
    matchesQuery,
    (snapshot): void => {
      const matches: Match[] = snapshot.docs.map((matchDoc) => {
        // Firestore returns untyped document data; matches/{matchId} is the
        // service boundary where the document id is injected into the app type.
        const data = matchDoc.data() as Match
        return {
          ...data,
          id: matchDoc.id,
        }
      })
      matches.sort(sortMatchesByActivity)
      onUpdate(matches)
    },
    onError
  )
}

/**
 * Reset the unread message count for a user on a given match to zero.
 * Called when the chat screen becomes active.
 */
export const resetUnreadCount = async (
  matchId: string,
  userId: string
): Promise<void> => {
  await updateDoc(doc(db, 'matches', matchId), {
    [`${userId}_unread`]: 0,
  })
}

interface DailyLikesDoc {
  count: number
  resetAt: Timestamp
}

/**
 * Returns { count, remaining } for the user's daily like quota.
 * Resets the Firestore doc to { count: 0 } if resetAt is before today midnight.
 * Creates the doc with count: 0 if it does not exist yet.
 */
export const getDailyLikesDoc = async (
  userId: string
): Promise<{ count: number; remaining: number }> => {
  const ref = doc(db, 'users', userId, 'dailyLikes', 'doc')
  const snap = await getDoc(ref)

  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)

  if (!snap.exists()) {
    await setDoc(ref, {
      count: 0,
      resetAt: Timestamp.fromDate(todayMidnight),
    })
    return { count: 0, remaining: DAILY_LIKE_CAP }
  }

  // Firestore document data is untyped at the service boundary.
  const data = snap.data() as DailyLikesDoc
  const resetAtDate = data.resetAt.toDate()

  if (resetAtDate < todayMidnight) {
    await setDoc(ref, {
      count: 0,
      resetAt: Timestamp.fromDate(todayMidnight),
    })
    return { count: 0, remaining: DAILY_LIKE_CAP }
  }

  const remaining = Math.max(0, DAILY_LIKE_CAP - data.count)
  return { count: data.count, remaining }
}

/**
 * Increments the daily like count by 1.
 * Must be called AFTER getDailyLikesDoc confirms the action is permitted.
 * Does NOT re-check the cap - caller is responsible for the guard.
 */
export const incrementDailyLikes = async (userId: string): Promise<void> => {
  const ref = doc(db, 'users', userId, 'dailyLikes', 'doc')
  const snap = await getDoc(ref)
  // Firestore document data is untyped at the service boundary.
  const current = snap.exists() ? (snap.data() as DailyLikesDoc).count : 0
  await updateDoc(ref, { count: current + 1 })
}
