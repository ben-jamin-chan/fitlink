import {
  Timestamp,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

import { db } from '@/services/firebase/config'

import type { LookingFor, UserProfile } from '@/types/user'

const FIRESTORE_WRITE_TIMEOUT_MS = 20000

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
    subscription: { tier: 'free' },
    verified: false,
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
  data: Partial<
    Omit<
      UserProfile,
      | 'uid'
      | 'age'
      | 'stats'
      | 'subscription'
      | 'banned'
      | 'verified'
      | 'createdAt'
    >
  >
): Promise<void> => {
  const userRef = doc(db, 'users', userId)

  await withWriteTimeout(
    updateDoc(userRef, {
      ...data,
      lastActive: serverTimestamp(),
    })
  )
}

/** Shape of the dailyLikes sub-document at /users/{userId}/dailyLikes/doc */
export interface DailyLikesDoc {
  count: number
  resetAt: Timestamp
}

const getTodayMidnight = (): Date => {
  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)
  return todayMidnight
}

/**
 * Returns the current dailyLikes doc for a user.
 * Missing or stale counters are treated as reset to 0 for today.
 */
export const getDailyLikesDoc = async (
  userId: string
): Promise<DailyLikesDoc> => {
  const ref = doc(db, 'users', userId, 'dailyLikes', 'doc')
  const snap = await getDoc(ref)
  const todayMidnight = getTodayMidnight()

  if (!snap.exists()) {
    return { count: 0, resetAt: Timestamp.fromDate(todayMidnight) }
  }

  const data = snap.data()
  const count = typeof data.count === 'number' ? data.count : 0
  const resetAt =
    data.resetAt instanceof Timestamp
      ? data.resetAt
      : Timestamp.fromDate(todayMidnight)

  if (resetAt.toDate() < todayMidnight) {
    return { count: 0, resetAt: Timestamp.fromDate(todayMidnight) }
  }

  return { count, resetAt }
}

/**
 * Increments the daily like count by 1.
 * Missing or stale counters are reset first, then counted as today's first like.
 */
export const incrementDailyLikes = async (userId: string): Promise<void> => {
  const ref = doc(db, 'users', userId, 'dailyLikes', 'doc')
  const snap = await getDoc(ref)
  const todayMidnight = getTodayMidnight()
  const nextMidnight = new Date(todayMidnight)
  nextMidnight.setDate(nextMidnight.getDate() + 1)

  const resetAt = snap.exists() ? snap.data().resetAt : undefined
  const isStale =
    !(resetAt instanceof Timestamp) || resetAt.toDate() < todayMidnight

  if (!snap.exists() || isStale) {
    await setDoc(
      ref,
      {
        count: 1,
        resetAt: Timestamp.fromDate(nextMidnight),
      },
      { merge: true }
    )
    return
  }

  await updateDoc(ref, {
    count: increment(1),
  })
}
