import type { Timestamp } from 'firebase/firestore'

// Subscription / Premium

export type PremiumTier = 'plus' | 'pro'

export type UpsellReason = 'likes' | 'superLike' | 'rewind'

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled'

export interface PremiumStatus {
  active: boolean
  tier: PremiumTier | null
  subscriptionId: string | null
  expiresAt: Timestamp | null
}

export interface StripePrice {
  priceId: string
  amount: number                       // in smallest currency unit (e.g. cents for MYR)
  amountDisplay: string                // formatted display string (e.g. RM 29.90)
  currency: string                     // ISO 4217 (e.g. 'MYR', 'SGD')
  interval: 'month' | '3month' | '6month'
}

// Fitness Tracking

export type FitnessTrackingSource = 'appleHealth' | 'googleFit' | 'strava'

export interface WorkoutSession {
  type: string
  duration: number                     // minutes
  distance?: number                    // km
  calories?: number
  elevation?: number                   // metres (Strava)
}

export interface TodayStats {
  steps: number
  distance: number                     // km
  calories: number
  workouts: WorkoutSession[]
  updatedAt: Timestamp
  source?: FitnessTrackingSource
}

export interface FitnessSourceConnection {
  connected: boolean
  lastSync: Timestamp | null
}

export interface StravaConnection extends FitnessSourceConnection {
  accessToken: string
  refreshToken: string                 // stored encrypted - never expose client-side
  expiresAt: number                    // Unix timestamp (seconds)
}

export interface FitnessTracking {
  appleHealth?: FitnessSourceConnection
  googleFit?: FitnessSourceConnection
  strava?: StravaConnection
  todayStats?: TodayStats
  shareOnProfile: boolean
}
