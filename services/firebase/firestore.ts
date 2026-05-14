import {
  Timestamp,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

import { db } from '@/services/firebase/config'

import type { LookingFor, UserProfile } from '@/types/user'

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

  await setDoc(userRef, profileData)
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

  await updateDoc(userRef, {
    ...data,
    lastActive: serverTimestamp(),
  })
}
