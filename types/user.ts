import { GeoPoint, Timestamp } from 'firebase/firestore'

export type Gender = 'male' | 'female' | 'non-binary'

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced' | 'athlete'

export type LookingFor = 'friends' | 'workout_partners' | 'dating'

export type SmokingStatus = 'yes' | 'no' | 'occasionally'

export type DrinkingStatus = 'yes' | 'no' | 'socially'

export interface UserLocation {
  city: string
  country: string
  coordinates: GeoPoint
}

export interface UserPreferences {
  ageRange: { min: number; max: number }
  distanceKm: number
  genders: string[]
}

export interface UserStats {
  likes: number
  passes: number
  matches: number
}

export interface UserSubscription {
  tier: 'free' | 'premium'
  expiresAt?: Timestamp
}

export interface UserProfile {
  uid: string
  firstName: string
  dateOfBirth: Timestamp
  age: number
  gender: Gender
  location: UserLocation
  photos: string[]
  bio: string
  height: number
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
  subscription: UserSubscription
  verified: boolean
  paused: boolean
  banned: boolean
  expoPushToken?: string
  language: string
  createdAt: Timestamp
  lastActive: Timestamp
}

export interface DailyLikes {
  count: number
  resetAt: Timestamp
}
