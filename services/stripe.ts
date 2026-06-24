import {
  getFunctions,
  httpsCallable,
  type HttpsCallableResult,
} from 'firebase/functions'
import { Linking } from 'react-native'

import {
  COUNTRY_CURRENCIES,
  SUPPORTED_COUNTRIES,
} from '@/constants/regions'
import type { SupportedCountry } from '@/constants/regions'
import type { PremiumTier, StripePrice } from '@/types/subscription'

type BillingInterval = 'month' | '3month' | '6month'
type CurrencyCode = 'MYR' | 'SGD' | 'THB' | 'PHP' | 'IDR' | 'VND'

interface PricingEntry {
  amount: number
  amountDisplay: string
  currency: CurrencyCode
  interval: BillingInterval
  priceId: string
}

interface CreateCheckoutResult {
  clientSecret: string
  subscriptionId: string
  customerId: string
}

interface CreateCustomerPortalSessionResult {
  url: string
}

const DEFAULT_CURRENCY: CurrencyCode = 'MYR'
const SUPPORTED_CURRENCY_CODES: readonly CurrencyCode[] = [
  'MYR',
  'SGD',
  'THB',
  'PHP',
  'IDR',
  'VND',
]

const getSupportedCountry = (country: string): SupportedCountry | null =>
  SUPPORTED_COUNTRIES.find(
    (supportedCountry: SupportedCountry): boolean =>
      supportedCountry === country
  ) ?? null

const isCurrencyCode = (currency: string): currency is CurrencyCode =>
  SUPPORTED_CURRENCY_CODES.some(
    (supportedCurrency: CurrencyCode): boolean =>
      supportedCurrency === currency
  )

const PRICING_TABLE: Record<
  CurrencyCode,
  Record<PremiumTier, Record<BillingInterval, PricingEntry>>
> = {
  MYR: {
    plus: {
      month: {
        amount: 2990,
        amountDisplay: 'RM 29.90',
        currency: 'MYR',
        interval: 'month',
        priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY ?? '',
      },
      '3month': {
        amount: 8091,
        amountDisplay: 'RM 80.91',
        currency: 'MYR',
        interval: '3month',
        priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_3MONTH ?? '',
      },
      '6month': {
        amount: 14352,
        amountDisplay: 'RM 143.52',
        currency: 'MYR',
        interval: '6month',
        priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_6MONTH ?? '',
      },
    },
    pro: {
      month: {
        amount: 4990,
        amountDisplay: 'RM 49.90',
        currency: 'MYR',
        interval: 'month',
        priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? '',
      },
      '3month': {
        amount: 13473,
        amountDisplay: 'RM 134.73',
        currency: 'MYR',
        interval: '3month',
        priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_3MONTH ?? '',
      },
      '6month': {
        amount: 23952,
        amountDisplay: 'RM 239.52',
        currency: 'MYR',
        interval: '6month',
        priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_6MONTH ?? '',
      },
    },
  },
  SGD: {
    plus: {
      month: {
        amount: 1290,
        amountDisplay: 'S$12.90',
        currency: 'SGD',
        interval: 'month',
        priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY ?? '',
      },
      '3month': {
        amount: 3483,
        amountDisplay: 'S$34.83',
        currency: 'SGD',
        interval: '3month',
        priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_3MONTH ?? '',
      },
      '6month': {
        amount: 6192,
        amountDisplay: 'S$61.92',
        currency: 'SGD',
        interval: '6month',
        priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_6MONTH ?? '',
      },
    },
    pro: {
      month: {
        amount: 1990,
        amountDisplay: 'S$19.90',
        currency: 'SGD',
        interval: 'month',
        priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? '',
      },
      '3month': {
        amount: 5373,
        amountDisplay: 'S$53.73',
        currency: 'SGD',
        interval: '3month',
        priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_3MONTH ?? '',
      },
      '6month': {
        amount: 9552,
        amountDisplay: 'S$95.52',
        currency: 'SGD',
        interval: '6month',
        priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_6MONTH ?? '',
      },
    },
  },
  THB: {
    plus: {
      month: {
        amount: 29900,
        amountDisplay: '฿299',
        currency: 'THB',
        interval: 'month',
        priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY ?? '',
      },
      '3month': {
        amount: 80700,
        amountDisplay: '฿807',
        currency: 'THB',
        interval: '3month',
        priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_3MONTH ?? '',
      },
      '6month': {
        amount: 143500,
        amountDisplay: '฿1,435',
        currency: 'THB',
        interval: '6month',
        priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PLUS_6MONTH ?? '',
      },
    },
    pro: {
      month: {
        amount: 49900,
        amountDisplay: '฿499',
        currency: 'THB',
        interval: 'month',
        priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? '',
      },
      '3month': {
        amount: 134700,
        amountDisplay: '฿1,347',
        currency: 'THB',
        interval: '3month',
        priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_3MONTH ?? '',
      },
      '6month': {
        amount: 239500,
        amountDisplay: '฿2,395',
        currency: 'THB',
        interval: '6month',
        priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO_6MONTH ?? '',
      },
    },
  },
  PHP: {
    plus: {
      month: {
        amount: 49900,
        amountDisplay: '₱499',
        currency: 'PHP',
        interval: 'month',
        priceId:
          process.env.EXPO_PUBLIC_STRIPE_PRICE_PHP_PLUS_MONTHLY ?? '',
      },
      '3month': {
        amount: 134700,
        amountDisplay: '₱1,347',
        currency: 'PHP',
        interval: '3month',
        priceId:
          process.env.EXPO_PUBLIC_STRIPE_PRICE_PHP_PLUS_3MONTH ?? '',
      },
      '6month': {
        amount: 239500,
        amountDisplay: '₱2,395',
        currency: 'PHP',
        interval: '6month',
        priceId:
          process.env.EXPO_PUBLIC_STRIPE_PRICE_PHP_PLUS_6MONTH ?? '',
      },
    },
    pro: {
      month: {
        amount: 79900,
        amountDisplay: '₱799',
        currency: 'PHP',
        interval: 'month',
        priceId:
          process.env.EXPO_PUBLIC_STRIPE_PRICE_PHP_PRO_MONTHLY ?? '',
      },
      '3month': {
        amount: 215700,
        amountDisplay: '₱2,157',
        currency: 'PHP',
        interval: '3month',
        priceId:
          process.env.EXPO_PUBLIC_STRIPE_PRICE_PHP_PRO_3MONTH ?? '',
      },
      '6month': {
        amount: 383500,
        amountDisplay: '₱3,835',
        currency: 'PHP',
        interval: '6month',
        priceId:
          process.env.EXPO_PUBLIC_STRIPE_PRICE_PHP_PRO_6MONTH ?? '',
      },
    },
  },
  IDR: {
    plus: {
      month: {
        amount: 12900000,
        amountDisplay: 'Rp 129,000',
        currency: 'IDR',
        interval: 'month',
        priceId:
          process.env.EXPO_PUBLIC_STRIPE_PRICE_IDR_PLUS_MONTHLY ?? '',
      },
      '3month': {
        amount: 34830000,
        amountDisplay: 'Rp 348,300',
        currency: 'IDR',
        interval: '3month',
        priceId:
          process.env.EXPO_PUBLIC_STRIPE_PRICE_IDR_PLUS_3MONTH ?? '',
      },
      '6month': {
        amount: 61920000,
        amountDisplay: 'Rp 619,200',
        currency: 'IDR',
        interval: '6month',
        priceId:
          process.env.EXPO_PUBLIC_STRIPE_PRICE_IDR_PLUS_6MONTH ?? '',
      },
    },
    pro: {
      month: {
        amount: 19900000,
        amountDisplay: 'Rp 199,000',
        currency: 'IDR',
        interval: 'month',
        priceId:
          process.env.EXPO_PUBLIC_STRIPE_PRICE_IDR_PRO_MONTHLY ?? '',
      },
      '3month': {
        amount: 53730000,
        amountDisplay: 'Rp 537,300',
        currency: 'IDR',
        interval: '3month',
        priceId:
          process.env.EXPO_PUBLIC_STRIPE_PRICE_IDR_PRO_3MONTH ?? '',
      },
      '6month': {
        amount: 95520000,
        amountDisplay: 'Rp 955,200',
        currency: 'IDR',
        interval: '6month',
        priceId:
          process.env.EXPO_PUBLIC_STRIPE_PRICE_IDR_PRO_6MONTH ?? '',
      },
    },
  },
  VND: {
    plus: {
      month: {
        amount: 24900000,
        amountDisplay: '₫249,000',
        currency: 'VND',
        interval: 'month',
        priceId:
          process.env.EXPO_PUBLIC_STRIPE_PRICE_VND_PLUS_MONTHLY ?? '',
      },
      '3month': {
        amount: 67230000,
        amountDisplay: '₫672,300',
        currency: 'VND',
        interval: '3month',
        priceId:
          process.env.EXPO_PUBLIC_STRIPE_PRICE_VND_PLUS_3MONTH ?? '',
      },
      '6month': {
        amount: 119520000,
        amountDisplay: '₫1,195,200',
        currency: 'VND',
        interval: '6month',
        priceId:
          process.env.EXPO_PUBLIC_STRIPE_PRICE_VND_PLUS_6MONTH ?? '',
      },
    },
    pro: {
      month: {
        amount: 39900000,
        amountDisplay: '₫399,000',
        currency: 'VND',
        interval: 'month',
        priceId:
          process.env.EXPO_PUBLIC_STRIPE_PRICE_VND_PRO_MONTHLY ?? '',
      },
      '3month': {
        amount: 107730000,
        amountDisplay: '₫1,077,300',
        currency: 'VND',
        interval: '3month',
        priceId:
          process.env.EXPO_PUBLIC_STRIPE_PRICE_VND_PRO_3MONTH ?? '',
      },
      '6month': {
        amount: 191520000,
        amountDisplay: '₫1,915,200',
        currency: 'VND',
        interval: '6month',
        priceId:
          process.env.EXPO_PUBLIC_STRIPE_PRICE_VND_PRO_6MONTH ?? '',
      },
    },
  },
}

export const getCurrency = (country: string): CurrencyCode => {
  const supportedCountry = getSupportedCountry(country)

  if (supportedCountry === null) {
    return DEFAULT_CURRENCY
  }

  const currency = COUNTRY_CURRENCIES[supportedCountry]

  return isCurrencyCode(currency) ? currency : DEFAULT_CURRENCY
}

export const getPricesForCountry = (
  country: SupportedCountry | string
): Record<PremiumTier, Record<BillingInterval, PricingEntry>> => {
  const currency = getCurrency(country)

  return PRICING_TABLE[currency] ?? PRICING_TABLE[DEFAULT_CURRENCY]
}

export const getStripePrices = (
  country: string
): Record<PremiumTier, Record<BillingInterval, PricingEntry>> =>
  getPricesForCountry(country)

export const getPrice = (
  country: string,
  tier: PremiumTier,
  interval: BillingInterval
): StripePrice => {
  const prices = getStripePrices(country)
  const entry = prices[tier][interval]

  return {
    priceId: entry.priceId,
    amount: entry.amount,
    amountDisplay: entry.amountDisplay,
    currency: entry.currency,
    interval: entry.interval,
  }
}

export const createSubscription = async (
  priceId: string
): Promise<CreateCheckoutResult> => {
  const functions = getFunctions(undefined, 'asia-southeast1')
  const createCheckout = httpsCallable<
    { priceId: string },
    CreateCheckoutResult
  >(functions, 'createStripeCheckout')

  const result = await createCheckout({ priceId })

  return result.data
}

export const openCustomerPortal = async (): Promise<void> => {
  const functions = getFunctions(undefined, 'asia-southeast1')
  const createPortalSession = httpsCallable<
    Record<string, never>,
    CreateCustomerPortalSessionResult
  >(functions, 'createCustomerPortalSession')

  const result: HttpsCallableResult<CreateCustomerPortalSessionResult> =
    await createPortalSession({})
  const { url } = result.data

  if (url.length === 0) {
    throw new Error('portal_url_missing')
  }

  const canOpen = await Linking.canOpenURL(url)
  if (!canOpen) {
    throw new Error('portal_url_not_openable')
  }

  await Linking.openURL(url)
}
