import type { Timestamp, GeoPoint } from 'firebase/firestore'
import type { PremiumStatus, FitnessTracking } from '@/types/subscription'

export type Gender = 'male' | 'female' | 'non-binary'

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced' | 'athlete'

export type LookingFor = 'friends' | 'workout_partners' | 'dating'

export type SmokingStatus = 'yes' | 'no' | 'occasionally'

export type DrinkingStatus = 'yes' | 'no' | 'socially'

export interface UserPreferences {
  ageRange: { min: number; max: number }
  distanceKm: number
  genders: string[]
  lookingFor: LookingFor[]
}

export interface UserStats {
  likes: number
  passes: number
  matches: number
}

export interface UserBoost {
  activatedAt: Timestamp
  expiresAt: Timestamp
}

export interface UserProfile {
  uid: string
  firstName: string
  dateOfBirth: Timestamp
  age: number                          // calculated server-side - never trust client
  gender: Gender
  location: {
    city: string
    country: string
    coordinates: GeoPoint
  }
  photos: string[]                     // Cloud Storage URLs; index 0 = primary photo
  bio: string                          // 50-500 chars
  height: number                       // cm
  religion?: string
  activities: string[]
  fitnessLevel: FitnessLevel
  workoutFrequency: string
  dietaryPreference: string
  fitnessGoals: string[]
  smoking: SmokingStatus
  drinking: DrinkingStatus
  lookingFor: LookingFor[]
  preferences: UserPreferences
  stats: UserStats
  premium: PremiumStatus               // replaces subscription - Phase 2
  photoVerified: boolean               // replaces verified - Phase 2
  verifiedAt?: Timestamp
  stripeCustomerId?: string
  fitnessTracking?: FitnessTracking
  paused: boolean
  banned: boolean
  expoPushToken?: string
  language: string
  timezone?: string
  // IANA timezone string, e.g. 'Asia/Kuala_Lumpur', 'Asia/Singapore', 'Asia/Bangkok'
  // Written at onboarding Step 1 (Task 81). Used by recordSwipe and verifyProfilePhoto
  // Cloud Functions (Task 82) for per-user midnight reset. Optional so existing users
  // without the field fall back to 'Asia/Kuala_Lumpur' on the server side.
  incognito?: boolean
  // Pro tier feature. When true, this user is excluded from all other users'
  // discovery stacks by getDiscoveryStack (Task 73). The user themselves can still
  // swipe normally. Client-writable (same as `paused`). Defaults to false if absent.
  boost?: UserBoost
  // Pro tier feature. Set server-side by the activateBoost Cloud Function (Task 74).
  // When expiresAt is in the future, getDiscoveryStack adds a scoring bonus.
  // Blocked from client writes by firestore.rules.
  videoProfileUrl?: string
  // Cloud Storage download URL for the user's short video loop (max 15s).
  // Uploaded via storage.uploadVideoProfile (Task 77).
  // Empty string means no video - treat '' and undefined identically.
  gymCheckin?: {
    gymName: string
    expiresAt: Timestamp
  }
  // Denormalised snapshot written by the createCheckin Cloud Function (Task 79)
  // alongside the /gymCheckins/{id} document. Allows SwipeCard to show the
  // "At gym" badge without an extra collection query. Cleared on check-out.
  isSeedAccount?: boolean
  // Internal operational flag for beta seed profiles. Client UI must not branch on it.
  createdAt: Timestamp
  lastActive: Timestamp
}
