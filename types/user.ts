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
  createdAt: Timestamp
  lastActive: Timestamp
}
