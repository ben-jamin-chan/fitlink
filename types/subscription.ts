import { Timestamp } from 'firebase/firestore'

export type SubscriptionTier = 'free' | 'premium'

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled'

export interface Subscription {
  tier: SubscriptionTier
  status: SubscriptionStatus
  expiresAt?: Timestamp
  stripeCustomerId?: string
  stripeSubscriptionId?: string
}
