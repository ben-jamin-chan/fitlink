import { create } from 'zustand'

import { createSubscription, getPrice } from '@/services/stripe'
import { useProfileStore } from '@/store/profileStore'

import type { PremiumTier } from '@/types/subscription'

type BillingInterval = 'month' | '3month' | '6month'

interface SubscriptionState {
  selectedTier: PremiumTier
  selectedInterval: BillingInterval
  isLoading: boolean
  error: string | null
  pendingClientSecret: string | null
  pendingSubscriptionId: string | null
}

interface SubscriptionActions {
  setSelectedTier: (tier: PremiumTier) => void
  setSelectedInterval: (interval: BillingInterval) => void
  clearError: () => void
  beginSubscription: (country: string) => Promise<boolean>
  onPaymentComplete: () => void
  onPaymentFailed: (errorMessage: string) => void
  restorePurchases: () => Promise<void>
  isPremium: () => boolean
}

type SubscriptionStore = SubscriptionState & SubscriptionActions

const PRICE_NOT_CONFIGURED_ERROR = 'subscription.errors.priceNotConfigured'
const GENERIC_SUBSCRIPTION_ERROR = 'subscription.errors.generic'

const getSubscriptionErrorKey = (error: unknown): string => {
  if (
    error instanceof Error &&
    error.message === PRICE_NOT_CONFIGURED_ERROR
  ) {
    return PRICE_NOT_CONFIGURED_ERROR
  }

  return GENERIC_SUBSCRIPTION_ERROR
}

export const useSubscriptionStore = create<SubscriptionStore>()((set, get) => ({
  selectedTier: 'plus',
  selectedInterval: 'month',
  isLoading: false,
  error: null,
  pendingClientSecret: null,
  pendingSubscriptionId: null,

  setSelectedTier: (tier: PremiumTier): void => {
    set({ selectedTier: tier })
  },

  setSelectedInterval: (interval: BillingInterval): void => {
    set({ selectedInterval: interval })
  },

  clearError: (): void => {
    set({ error: null })
  },

  beginSubscription: async (country: string): Promise<boolean> => {
    const { selectedTier, selectedInterval } = get()

    set({
      isLoading: true,
      error: null,
      pendingClientSecret: null,
      pendingSubscriptionId: null,
    })

    try {
      const price = getPrice(country, selectedTier, selectedInterval)

      if (price.priceId.length === 0) {
        throw new Error(PRICE_NOT_CONFIGURED_ERROR)
      }

      const checkout = await createSubscription(price.priceId)

      set({
        isLoading: false,
        pendingClientSecret: checkout.clientSecret,
        pendingSubscriptionId: checkout.subscriptionId,
      })

      return true
    } catch (error: unknown) {
      set({
        isLoading: false,
        error: getSubscriptionErrorKey(error),
        pendingClientSecret: null,
        pendingSubscriptionId: null,
      })

      return false
    }
  },

  onPaymentComplete: (): void => {
    set({
      isLoading: false,
      error: null,
      pendingClientSecret: null,
      pendingSubscriptionId: null,
    })
  },

  onPaymentFailed: (errorMessage: string): void => {
    set({
      isLoading: false,
      error: errorMessage,
      pendingClientSecret: null,
      pendingSubscriptionId: null,
    })
  },

  restorePurchases: async (): Promise<void> => {
    // TODO Phase 3: Implement App Store / Play Store receipt validation.
  },

  isPremium: (): boolean => {
    const profile = useProfileStore.getState().profile

    if (profile === null || !profile.premium.active) {
      return false
    }

    if (profile.premium.expiresAt === null) {
      return false
    }

    return profile.premium.expiresAt.toMillis() > Date.now()
  },
}))
